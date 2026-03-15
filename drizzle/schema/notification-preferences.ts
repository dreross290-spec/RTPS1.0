/**
 * Drizzle schema – notification_preferences table
 *
 * Stores per-client opt-in/out preferences for SMS and email notifications,
 * contact hour windows, notification frequency, and encrypted PII (phone/email).
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  smallint,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** How frequently the client wants to receive notifications. */
export const notificationFrequencyEnum = pgEnum("notification_frequency", [
  "realtime",
  "daily_digest",
  "weekly",
]);

/**
 * notification_preferences
 *
 * One row per client. Stores opt-in flags, preferred contact window,
 * notification frequency, encrypted contact details, and a JSONB map of
 * per-event-type overrides.
 *
 * smsPhoneNumber and emailAddress are stored AES-256-GCM encrypted so raw
 * PII never appears in the database.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    /** Surrogate primary key (UUID v4). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** Foreign key reference to the client record in the main application DB. */
    clientId: uuid("client_id").notNull().unique(),

    /** Whether SMS notifications are enabled for this client. */
    smsEnabled: boolean("sms_enabled").notNull().default(false),

    /** Whether email notifications are enabled for this client. */
    emailEnabled: boolean("email_enabled").notNull().default(true),

    /**
     * Start of preferred contact window (0–23, UTC hour).
     * Notifications queued outside this window are held until the window opens.
     */
    preferredContactHoursStart: smallint("preferred_contact_hours_start")
      .notNull()
      .default(8),

    /**
     * End of preferred contact window (0–23, UTC hour, exclusive).
     * Must be greater than preferredContactHoursStart.
     */
    preferredContactHoursEnd: smallint("preferred_contact_hours_end")
      .notNull()
      .default(21),

    /** How often the client receives notifications. */
    notificationFrequency: notificationFrequencyEnum("notification_frequency")
      .notNull()
      .default("realtime"),

    /**
     * AES-256-GCM encrypted phone number (E.164 format before encryption).
     * Format: `<hex_iv>:<hex_authTag>:<hex_ciphertext>`
     */
    smsPhoneNumber: varchar("sms_phone_number", { length: 512 }),

    /**
     * AES-256-GCM encrypted email address.
     * Format: `<hex_iv>:<hex_authTag>:<hex_ciphertext>`
     */
    emailAddress: varchar("email_address", { length: 512 }),

    /**
     * JSONB object mapping RefundEventType keys to boolean opt-in flags.
     * Allows clients to subscribe to specific event types only.
     * Example: { "REFUND_APPROVED": true, "REFUND_REJECTED": false }
     */
    eventTypePreferences: jsonb("event_type_preferences")
      .$type<Record<string, boolean>>()
      .default({}),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("idx_notification_preferences_client_id").on(table.clientId),
  ],
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type NotificationFrequency = (typeof notificationFrequencyEnum.enumValues)[number];
