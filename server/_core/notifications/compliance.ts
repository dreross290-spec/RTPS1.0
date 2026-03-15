/**
 * TCPA / CAN-SPAM Compliance Module
 *
 * Enforces TCPA consent requirements before SMS dispatch and CAN-SPAM
 * requirements before email dispatch.  Provides token-based unsubscribe
 * link generation and contact-hour window checking.
 *
 * References:
 *   TCPA: 47 U.S.C. § 227
 *   CAN-SPAM Act: 15 U.S.C. §§ 7701-7713
 */

import { eq, and, isNull } from "drizzle-orm";
import { createHmac } from "node:crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../../../drizzle/schema/index.js";
import { tcpaConsent, notificationPreferences } from "../../../drizzle/schema/index.js";
import { maskPhone } from "../../lib/utils/masking.js";
import type { ComplianceResult, NotificationPreferences, TCPAConsent } from "./types.js";

type AppDB = PostgresJsDatabase<typeof schema>;

// ─── Token ────────────────────────────────────────────────────────────────────

const TOKEN_SEPARATOR = ".";
const TOKEN_VERSION = "v1";

function getHmacSecret(): string {
  const secret = process.env["UNSUBSCRIBE_HMAC_SECRET"] ?? process.env["ENCRYPTION_KEY"] ?? "";
  if (!secret) {
    throw new Error("UNSUBSCRIBE_HMAC_SECRET or ENCRYPTION_KEY environment variable required");
  }
  return secret;
}

// ─── Compliance Manager ───────────────────────────────────────────────────────

export class ComplianceManager {
  private readonly db: AppDB;

  constructor(db: AppDB) {
    this.db = db;
  }

  /**
   * Checks TCPA compliance for a client + phone number.
   * Returns a ComplianceResult indicating whether SMS may be sent.
   */
  async checkTCPACompliance(
    clientId: string,
    maskedPhone: string,
  ): Promise<ComplianceResult> {
    const activeConsent = await this.getActiveConsent(clientId, maskedPhone);

    if (activeConsent === null) {
      return {
        compliant: false,
        reason: "No active TCPA consent record found for this client and phone number.",
      };
    }

    return {
      compliant: true,
      consentId: activeConsent.id,
    };
  }

  /**
   * Records new TCPA consent for a client.
   */
  async recordConsent(
    clientId: string,
    phone: string,
    consentType: "express_written" | "express_verbal" | "prior_business",
    consentDocument?: string,
  ): Promise<void> {
    const masked = maskPhone(phone);

    await this.db.insert(tcpaConsent).values({
      clientId,
      phoneNumber: masked,
      consentType,
      consentDocument: consentDocument ?? null,
      consentDate: new Date(),
    });
  }

  /**
   * Revokes TCPA consent for a client (soft delete via revokedAt timestamp).
   */
  async revokeConsent(clientId: string, reason: string): Promise<void> {
    await this.db
      .update(tcpaConsent)
      .set({
        revokedAt: new Date(),
        revokedReason: reason.slice(0, 500),
      })
      .where(
        and(
          eq(tcpaConsent.clientId, clientId),
          isNull(tcpaConsent.revokedAt),
        ),
      );

    // Also disable SMS in notification preferences
    await this.db
      .update(notificationPreferences)
      .set({
        smsEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.clientId, clientId));
  }

  /**
   * Returns all active (non-revoked) consent records for a client.
   */
  async getActiveConsents(clientId: string): Promise<TCPAConsent[]> {
    const rows = await this.db
      .select()
      .from(tcpaConsent)
      .where(
        and(
          eq(tcpaConsent.clientId, clientId),
          isNull(tcpaConsent.revokedAt),
        ),
      );

    return rows.map(mapConsentRow);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async getActiveConsent(
    clientId: string,
    maskedPhone: string,
  ): Promise<TCPAConsent | null> {
    const rows = await this.db
      .select()
      .from(tcpaConsent)
      .where(
        and(
          eq(tcpaConsent.clientId, clientId),
          eq(tcpaConsent.phoneNumber, maskedPhone),
          isNull(tcpaConsent.revokedAt),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row !== undefined ? mapConsentRow(row) : null;
  }
}

// ─── Standalone Functions ─────────────────────────────────────────────────────

/**
 * Returns true if the current UTC time falls within the client's preferred
 * contact window.
 */
export function isWithinContactHours(prefs: NotificationPreferences): boolean {
  const nowHour = new Date().getUTCHours();
  const { preferredContactHoursStart: start, preferredContactHoursEnd: end } = prefs;

  if (start <= end) {
    return nowHour >= start && nowHour < end;
  }

  // Overnight window (e.g., 22:00 – 06:00)
  return nowHour >= start || nowHour < end;
}

/**
 * Generates a time-limited HMAC-based unsubscribe token for a client.
 * Format: v1.<clientId>.<expiresAt>.<hmac>
 */
export function generateUnsubscribeToken(clientId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
  const payload = `${TOKEN_VERSION}${TOKEN_SEPARATOR}${clientId}${TOKEN_SEPARATOR}${expiresAt}`;
  const hmac = computeHmac(payload);
  return `${payload}${TOKEN_SEPARATOR}${hmac}`;
}

/**
 * Validates an unsubscribe token and returns the clientId if valid, or null.
 */
export function validateUnsubscribeToken(token: string): string | null {
  const parts = token.split(TOKEN_SEPARATOR);
  if (parts.length !== 4) return null;

  const [version, clientId, expiresAtStr, receivedHmac] = parts as [
    string,
    string,
    string,
    string,
  ];

  if (version !== TOKEN_VERSION) return null;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return null; // Expired
  }

  const payload = `${version}${TOKEN_SEPARATOR}${clientId}${TOKEN_SEPARATOR}${expiresAtStr}`;
  const expectedHmac = computeHmac(payload);

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(receivedHmac, expectedHmac)) return null;

  return clientId;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHmac(payload: string): string {
  return createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return result === 0;
}

function mapConsentRow(row: typeof tcpaConsent.$inferSelect): TCPAConsent {
  return {
    id: row.id,
    clientId: row.clientId,
    maskedPhone: row.phoneNumber,
    consentDate: row.consentDate,
    consentType: row.consentType,
    consentDocument: row.consentDocument,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
  };
}
