/**
 * Drizzle schema – notification_events & notification_queue tables
 *
 * notification_events : Immutable record of every notification decision made
 *                       (one row per message sent or suppressed).
 * notification_queue  : Outbound queue for messages that need to be sent,
 *                       retried, or held until a contact-hour window opens.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Communication channel used. */
export const channelEnum = pgEnum("channel", ["sms", "email"]);

/** Lifecycle state of a queued notification. */
export const queueStatusEnum = pgEnum("queue_status", [
  "pending",
  "processing",
  "sent",
  "delivered",
  "failed",
  "suppressed",
  "scheduled",
]);

/**
 * notification_events
 *
 * Append-only audit ledger.  One row per notification decision.
 * Links back to the refund status event that triggered the notification.
 */
export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** Client that should receive (or was suppressed from receiving) the notification. */
    clientId: uuid("client_id").notNull(),

    /** FK to refund_status_history row that triggered this notification. */
    refundStatusHistoryId: uuid("refund_status_history_id").notNull(),

    /** Channel used. */
    channel: channelEnum("channel").notNull(),

    /** Refund event type that triggered this notification (e.g. "REFUND_APPROVED"). */
    eventType: varchar("event_type", { length: 100 }).notNull(),

    /** Processing/delivery status. */
    status: queueStatusEnum("status").notNull().default("pending"),

    /**
     * Provider-assigned message ID (e.g. Twilio MessageSid or SendGrid message_id).
     * NULL until the provider accepts the message.
     */
    providerMessageId: varchar("provider_message_id", { length: 255 }),

    /** Reason the message was suppressed (if status = suppressed). */
    suppressionReason: varchar("suppression_reason", { length: 500 }),

    /** Snapshot of the rendered message content (for audit; no raw PII). */
    renderedContent: text("rendered_content"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("idx_notification_events_client_id").on(table.clientId),
    index("idx_notification_events_status").on(table.status),
    index("idx_notification_events_created_at").on(table.createdAt),
    index("idx_notification_events_refund_history_id").on(
      table.refundStatusHistoryId,
    ),
  ],
);

/**
 * notification_queue
 *
 * Active outbound queue.  Rows move from pending → processing → sent/failed.
 * Rows in "scheduled" state are held until their scheduledFor timestamp.
 * Failed rows are retried up to maxRetries times with exponential backoff.
 */
export const notificationQueue = pgTable(
  "notification_queue",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** FK to notification_events. */
    notificationEventId: uuid("notification_event_id").notNull(),

    /** Client this message is for. */
    clientId: uuid("client_id").notNull(),

    /** Channel. */
    channel: channelEnum("channel").notNull(),

    /**
     * Serialized message payload (channel-specific structure).
     * For SMS: { to, body }
     * For email: { to, templateId, dynamicTemplateData }
     * Recipient address stored encrypted.
     */
    payload: jsonb("payload").notNull(),

    /** Current queue status. */
    status: queueStatusEnum("status").notNull().default("pending"),

    /** Number of send attempts made so far. */
    attemptCount: integer("attempt_count").notNull().default(0),

    /** Maximum retries allowed before transitioning to "failed". */
    maxRetries: integer("max_retries").notNull().default(3),

    /** Timestamp after which this message should be sent (for scheduled/digest). */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),

    /** Timestamp of the last send attempt. */
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    /** Error detail from the last failed attempt. */
    lastError: text("last_error"),

    /** Timestamp when this row was successfully processed (terminal state). */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("idx_notification_queue_status").on(table.status),
    index("idx_notification_queue_client_id").on(table.clientId),
    index("idx_notification_queue_scheduled_for").on(table.scheduledFor),
    index("idx_notification_queue_event_id").on(table.notificationEventId),
  ],
);

export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type NewNotificationEvent = typeof notificationEvents.$inferInsert;
export type NotificationQueueItem = typeof notificationQueue.$inferSelect;
export type NewNotificationQueueItem = typeof notificationQueue.$inferInsert;
export type Channel = (typeof channelEnum.enumValues)[number];
export type QueueStatus = (typeof queueStatusEnum.enumValues)[number];
