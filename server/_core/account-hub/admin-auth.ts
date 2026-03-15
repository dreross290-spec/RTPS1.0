import * as speakeasy from "speakeasy";
import { db } from "@server/lib/db";
import { accountAdmins } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";

const SESSION_TIMEOUT_MS =
  parseInt(process.env.ADMIN_SESSION_TIMEOUT ?? "1800") * 1000;

// In-memory session store — replace with Redis in production
const sessionStore = new Map<string, AdminSession>();

export interface AdminSession {
  sessionToken: string;
  adminId: string;
  accountId: string;
  userId: string;
  role: string;
  ip: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Verify a TOTP MFA token for a given user.
 */
export async function verifyMFA(userId: string, token: string): Promise<boolean> {
  const admin = await db.query.accountAdmins.findFirst({
    where: eq(accountAdmins.userId, userId),
  });

  if (!admin || !admin.mfaEnabled || !admin.mfaSecret) {
    return false;
  }

  return speakeasy.totp.verify({
    secret: admin.mfaSecret,
    encoding: "base32",
    token,
    window: 1,
  });
}

/**
 * Check whether an IP address is allowed for a given account.
 * An empty allowlist means all IPs are permitted.
 */
export async function checkIPAllowlist(
  accountId: string,
  ip: string
): Promise<boolean> {
  const admin = await db.query.accountAdmins.findFirst({
    where: eq(accountAdmins.accountId, accountId),
  });

  if (!admin) return false;

  const allowlist = (admin.ipAllowlist ?? []) as string[];
  if (allowlist.length === 0) return true;

  return allowlist.some((allowed) => {
    // Support CIDR notation for subnet matching
    if (allowed.includes("/")) {
      return isIPInCIDR(ip, allowed);
    }
    return allowed === ip;
  });
}

/**
 * Create a new admin session.
 */
export async function createAdminSession(
  adminId: string,
  ip: string
): Promise<AdminSession> {
  const admin = await db.query.accountAdmins.findFirst({
    where: eq(accountAdmins.adminId, adminId),
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  const sessionToken = crypto.randomBytes(48).toString("hex");
  const now = new Date();
  const session: AdminSession = {
    sessionToken,
    adminId,
    accountId: admin.accountId,
    userId: admin.userId,
    role: admin.role,
    ip,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TIMEOUT_MS),
  };

  sessionStore.set(sessionToken, session);

  // Update last login timestamp
  await db
    .update(accountAdmins)
    .set({ lastLoginAt: now })
    .where(eq(accountAdmins.adminId, adminId));

  return session;
}

/**
 * Validate an admin session token.
 * Returns null if the session is expired or not found.
 */
export async function validateAdminSession(
  sessionToken: string
): Promise<AdminSession | null> {
  const session = sessionStore.get(sessionToken);
  if (!session) return null;

  if (new Date() > session.expiresAt) {
    sessionStore.delete(sessionToken);
    return null;
  }

  // Sliding expiration — refresh on each valid access
  session.expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MS);
  return session;
}

/**
 * Invalidate (logout) an admin session.
 */
export function invalidateAdminSession(sessionToken: string): void {
  sessionStore.delete(sessionToken);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range ?? "");
  return (ipInt & mask) === (rangeInt & mask);
}

function ipToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
}

/**
 * Generate a TOTP secret for a new MFA enrollment.
 */
export function generateMFASecret(
  userId: string
): { secret: string; otpauthUrl: string } {
  const secretObj = speakeasy.generateSecret({
    name: `RTPS:${userId}`,
    length: 32,
  });

  return {
    secret: secretObj.base32,
    otpauthUrl: secretObj.otpauth_url ?? "",
  };
}
