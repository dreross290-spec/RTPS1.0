/**
 * Notification Audit Logger
 *
 * Provides structured, append-only JSON logging for all notification lifecycle
 * events.  All entries include a trace ID for correlation across services.
 * Raw PII is never logged; recipients are always in masked form.
 */

import { v4 as uuidv4 } from "uuid";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../../../drizzle/schema/index.js";
import { notificationAudit, providerWebhooks } from "../../../drizzle/schema/index.js";
import type { MaskedRecipient } from "../notifications/types.js";

type AppDB = PostgresJsDatabase<typeof schema>;

// ─── Logger ───────────────────────────────────────────────────────────────────

export class NotificationLogger {
  private readonly db: AppDB | null;

  /**
   * @param db - Drizzle database instance. Pass null for a log-only instance
   *             (useful in tests or when DB is not yet available).
   */
  constructor(db: AppDB | null = null) {
    this.db = db;
  }

  /**
   * Logs that a notification was dispatched to a provider.
   * Does NOT indicate delivery – only that the send was attempted.
   */
  async logNotificationSent(
    queueId: string,
    recipient: MaskedRecipient,
  ): Promise<void> {
    const traceId = uuidv4();
    this.writeLog({
      level: "info",
      event: "notification_sent",
      traceId,
      queueId,
      channel: recipient.channel,
      maskedRecipient: formatMaskedRecipient(recipient),
    });
  }

  /**
   * Logs that a notification bounced or was undeliverable.
   */
  async logNotificationBounced(queueId: string, reason: string): Promise<void> {
    const traceId = uuidv4();
    this.writeLog({
      level: "warn",
      event: "notification_bounced",
      traceId,
      queueId,
      reason: reason.slice(0, 500),
    });
  }

  /**
   * Logs that a notification was suppressed due to compliance rules.
   */
  async logNotificationSuppressed(
    queueId: string,
    channel: "sms" | "email",
    reason: string,
  ): Promise<void> {
    const traceId = uuidv4();
    this.writeLog({
      level: "info",
      event: "notification_suppressed",
      traceId,
      queueId,
      channel,
      reason: reason.slice(0, 500),
    });
  }

  /**
   * Logs that a notification delivery permanently failed.
   */
  async logNotificationFailed(
    queueId: string,
    channel: "sms" | "email",
    reason: string,
    attemptCount: number,
  ): Promise<void> {
    const traceId = uuidv4();
    this.writeLog({
      level: "error",
      event: "notification_failed",
      traceId,
      queueId,
      channel,
      reason: reason.slice(0, 500),
      attemptCount,
    });
  }

  /**
   * Logs an inbound provider webhook for compliance and debugging.
   * Payload is sanitized to remove any raw email addresses or phone numbers.
   */
  async logWebhookReceived(
    provider: string,
    eventType: string,
    queueId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const traceId = uuidv4();
    const safePayload = sanitizeWebhookPayload(payload);

    this.writeLog({
      level: "info",
      event: "webhook_received",
      traceId,
      provider,
      eventType,
      queueId,
      payload: safePayload,
    });
  }

  /**
   * Logs a client opt-out (SMS STOP reply, email unsubscribe, portal opt-out).
   * clientId may be "unknown" when the opt-out is received before we can
   * identify the client from the channel address.
   */
  async logOptOut(
    clientId: string,
    channel: string,
    source: string,
  ): Promise<void> {
    const traceId = uuidv4();
    this.writeLog({
      level: "info",
      event: "opt_out",
      traceId,
      clientId: clientId === "unknown" ? "unknown" : `${clientId.slice(0, 8)}****`,
      channel,
      source,
    });
  }

  /**
   * Logs a new TCPA consent record being captured.
   */
  async logConsentRecorded(
    clientId: string,
    consentType: string,
    maskedPhone: string,
  ): Promise<void> {
    const traceId = uuidv4();
    this.writeLog({
      level: "info",
      event: "consent_recorded",
      traceId,
      clientId: `${clientId.slice(0, 8)}****`,
      consentType,
      maskedPhone,
    });
  }

  /**
   * Logs a TCPA consent revocation.
   */
  async logConsentRevoked(clientId: string, reason: string): Promise<void> {
    const traceId = uuidv4();
    this.writeLog({
      level: "info",
      event: "consent_revoked",
      traceId,
      clientId: `${clientId.slice(0, 8)}****`,
      reason: reason.slice(0, 200),
    });
  }

  /**
   * Logs a refund status poll completion.
   */
  logPollCompleted(returnId: string, statusChanged: boolean): void {
    this.writeLog({
      level: "info",
      event: "poll_completed",
      traceId: uuidv4(),
      returnId,
      statusChanged,
    });
  }

  /**
   * Logs a polling failure.
   */
  logPollFailed(returnId: string, error: string, consecutiveFailures: number): void {
    this.writeLog({
      level: "warn",
      event: "poll_failed",
      traceId: uuidv4(),
      returnId,
      error: error.slice(0, 500),
      consecutiveFailures,
    });
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private writeLog(entry: Record<string, unknown>): void {
    const logEntry = {
      ...entry,
      service: "NotificationLogger",
      ts: new Date().toISOString(),
    };

    const level = entry["level"] as string;
    const json = JSON.stringify(logEntry);

    if (level === "error") {
      console.error(json);
    } else if (level === "warn") {
      console.warn(json);
    } else {
      console.log(json);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMaskedRecipient(r: MaskedRecipient): string {
  if (r.channel === "sms" && r.maskedPhone !== undefined) {
    return `sms:${r.maskedPhone}`;
  }
  if (r.channel === "email" && r.maskedEmail !== undefined) {
    return `email:${r.maskedEmail}`;
  }
  return r.channel;
}

/** Strips potential PII fields from webhook payloads before logging. */
function sanitizeWebhookPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const PII_KEYS = new Set([
    "email", "to", "from", "phone", "phonenumber",
    "body", "Body", "From", "To", "Email",
  ]);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PII_KEYS.has(key) && typeof value === "string") {
      result[key] = "[redacted]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeWebhookPayload(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
