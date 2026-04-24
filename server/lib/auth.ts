/**
 * Auth utilities: JWT sign/verify and bcrypt helpers.
 * Uses jose for standards-compliant JWT (RFC 7519).
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

// ── Key ──────────────────────────────────────────────────────────────────────

function getJwtKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  // Require at least 32 characters. For production, use a cryptographically
  // random secret: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable must be set to at least 32 characters."
    );
  }
  return new TextEncoder().encode(secret);
}

// ── Token payload ─────────────────────────────────────────────────────────────

export interface TokenPayload extends JWTPayload {
  sub: string; // userId
  email: string;
  role: "admin" | "staff";
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

/**
 * Sign a JWT token valid for 8 hours.
 */
export async function signToken(payload: Omit<TokenPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .setIssuer("rtps")
    .setAudience("rtps")
    .sign(getJwtKey());
}

/**
 * Verify a JWT token and return its payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwtKey(), {
    issuer: "rtps",
    audience: "rtps",
  });
  return payload as TokenPayload;
}

// ── Password helpers ───────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────

export const COOKIE_NAME = "rtps_token";

/** Serialize an httpOnly cookie string. */
export function serializeTokenCookie(token: string): string {
  const maxAge = 8 * 60 * 60; // 8 hours in seconds
  const isProduction = process.env.NODE_ENV === "production";
  return [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Serialize a cookie that clears the token. */
export function clearTokenCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

/** Extract the token string from the Cookie header. */
export function extractTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? match.slice(COOKIE_NAME.length + 1) : null;
}
