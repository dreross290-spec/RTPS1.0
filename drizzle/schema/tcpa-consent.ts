/**
 * Drizzle schema – tcpa_consent table
 *
 * Records express written consent for SMS marketing/informational messages
 * as required by the Telephone Consumer Protection Act (TCPA).
 * Each row is immutable once created; revocation inserts a revokedAt timestamp
 * via a soft-delete pattern.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * How consent was obtained.
 *
 * - express_written  : Client explicitly checked an opt-in box (highest standard).
 * - express_verbal   : Client gave verbal consent (recorded call / IVR).
 * - prior_business   : Existing business relationship exception (informational only).
 */
export const consentTypeEnum = pgEnum("consent_type", [
  "express_written",
  "express_verbal",
  "prior_business",
]);

/**
 * tcpa_consent
 *
 * Immutable consent audit trail.  Never update or delete rows; instead, set
 * revokedAt to record opt-out.
 *
 * phoneNumber is stored in masked format (e.g., "+1******7890") because the
 * raw number is encrypted elsewhere (notification_preferences.smsPhoneNumber).
 */
export const tcpaConsent = pgTable(
  "tcpa_consent",
  {
    /** Surrogate primary key (UUID v4). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** FK to the client record. Multiple consent rows may exist per client. */
    clientId: uuid("client_id").notNull(),

    /**
     * Masked phone number for audit purposes.
     * E.g. "+1******7890" – never store the raw number here.
     */
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),

    /** Timestamp when express consent was captured (with time-zone). */
    consentDate: timestamp("consent_date", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    /** Method through which consent was obtained. */
    consentType: consentTypeEnum("consent_type").notNull(),

    /**
     * Proof-of-consent document.  Could be a URL to a stored form submission,
     * a transcript ID, or a JSON blob describing the consent capture event.
     * Max 4 KB to keep the row compact.
     */
    consentDocument: text("consent_document"),

    /**
     * Timestamp when this consent record was revoked (opt-out).
     * NULL means the consent is currently active.
     */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /**
     * Human-readable reason for revocation.
     * E.g. "STOP SMS reply", "User requested opt-out via portal", etc.
     */
    revokedReason: varchar("revoked_reason", { length: 500 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("idx_tcpa_consent_client_id").on(table.clientId),
    index("idx_tcpa_consent_phone").on(table.phoneNumber),
    index("idx_tcpa_consent_revoked_at").on(table.revokedAt),
  ],
);

export type TcpaConsent = typeof tcpaConsent.$inferSelect;
export type NewTcpaConsent = typeof tcpaConsent.$inferInsert;
export type ConsentType = (typeof consentTypeEnum.enumValues)[number];
