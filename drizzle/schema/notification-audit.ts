/**
 * Drizzle schema – notification_audit & provider_webhooks tables
 *
 * notification_audit   : Immutable delivery-event log (sent, delivered, bounced,
 *                        failed, etc.) sourced from provider status callbacks.
 * provider_webhooks    : Raw inbound webhook payloads from Twilio and SendGrid,
 *                        kept for replay / debugging without data loss.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Delivery outcome events reported by the downstream SMS/email provider.
 * Mirrors Twilio MessageStatus and SendGrid event types.
 */
export const deliveryStatusEnum = pgEnum("delivery_status", [
  // Common
  "queued",
  "sent",
  "delivered",
  "failed",
  "undelivered",
  // Email-specific (SendGrid)
  "open",
  "click",
  "bounce",
  "spam_report",
  "unsubscribe",
  "deferred",
  "dropped",
  // SMS-specific (Twilio)
  "accepted",
  "scheduled",
  "canceled",
  "read",
]);

/** Which provider sent the status callback. */
export const providerEnum = pgEnum("provider", ["twilio", "sendgrid"]);

/**
 * notification_audit
 *
 * One row per delivery event received from the provider.  Append-only.
 */
export const notificationAudit = pgTable(
  "notification_audit",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** FK to notification_events.id (the original send decision). */
    notificationEventId: uuid("notification_event_id").notNull(),

    /** FK to notification_queue.id (the specific queue item). */
    notificationQueueId: uuid("notification_queue_id"),

    /** Client this audit record belongs to. */
    clientId: uuid("client_id").notNull(),

    /** Provider-assigned message identifier. */
    providerMessageId: varchar("provider_message_id", { length: 255 }).notNull(),

    /** Which provider reported this event. */
    provider: providerEnum("provider").notNull(),

    /** Delivery status event type. */
    deliveryStatus: deliveryStatusEnum("delivery_status").notNull(),

    /**
     * Provider-specific error code, if applicable.
     * E.g. Twilio error code "30003" or SendGrid bounce reason.
     */
    errorCode: varchar("error_code", { length: 50 }),

    /** Human-readable error message from the provider. */
    errorMessage: text("error_message"),

    /** When the provider reports this event occurred (provider timestamp). */
    eventTimestamp: timestamp("event_timestamp", { withTimezone: true }),

    /** FK to provider_webhooks.id for the raw inbound payload. */
    rawWebhookId: uuid("raw_webhook_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("idx_audit_notification_event_id").on(table.notificationEventId),
    index("idx_audit_client_id").on(table.clientId),
    index("idx_audit_provider_message_id").on(table.providerMessageId),
    index("idx_audit_delivery_status").on(table.deliveryStatus),
    index("idx_audit_created_at").on(table.createdAt),
  ],
);

/**
 * provider_webhooks
 *
 * Stores every raw inbound webhook payload from Twilio and SendGrid.
 * Used for debugging, replay, and compliance auditing.
 * Append-only; never update or delete rows.
 */
export const providerWebhooks = pgTable(
  "provider_webhooks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** Which provider sent this webhook. */
    provider: providerEnum("provider").notNull(),

    /**
     * HTTP request headers (JSON object).
     * Stored to verify signatures after the fact if needed.
     * Sensitive values (e.g., X-Twilio-Signature) should be redacted before
     * storage; the signature is verified at ingestion time.
     */
    headers: jsonb("headers"),

    /** Raw webhook body as received (JSON object or form-encoded parsed). */
    body: jsonb("body").notNull(),

    /**
     * Whether the webhook signature was verified at ingestion time.
     * FALSE rows should be investigated and never acted upon.
     */
    signatureVerified: boolean("signature_verified").notNull().default(false),

    /** Provider-assigned message ID extracted from the payload (for indexing). */
    providerMessageId: varchar("provider_message_id", { length: 255 }),

    /** Processing status: "unprocessed" | "processed" | "error". */
    processingStatus: varchar("processing_status", { length: 20 })
      .notNull()
      .default("unprocessed"),

    /** Error detail if processing failed. */
    processingError: text("processing_error"),

    /** When RTPS received this webhook. */
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    /** When RTPS finished processing this webhook. */
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_webhooks_provider").on(table.provider),
    index("idx_webhooks_provider_message_id").on(table.providerMessageId),
    index("idx_webhooks_processing_status").on(table.processingStatus),
    index("idx_webhooks_received_at").on(table.receivedAt),
  ],
);

export type NotificationAudit = typeof notificationAudit.$inferSelect;
export type NewNotificationAudit = typeof notificationAudit.$inferInsert;
export type ProviderWebhook = typeof providerWebhooks.$inferSelect;
export type NewProviderWebhook = typeof providerWebhooks.$inferInsert;
export type DeliveryStatus = (typeof deliveryStatusEnum.enumValues)[number];
export type Provider = (typeof providerEnum.enumValues)[number];
