/**
 * Drizzle schema – refund_status_history table
 *
 * Append-only ledger of every refund status change received from the IRS or
 * state tax authority.  Each row is immutable; updates are never applied.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  numeric,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * High-level refund processing status.
 * Maps to IRS WMR (Where's My Refund) status codes.
 */
export const refundStatusEnum = pgEnum("refund_status", [
  "return_received",
  "return_processing",
  "refund_approved",
  "refund_sent",
  "refund_deposited",
  "refund_rejected",
  "additional_info_required",
  "under_review",
  "offset_applied",
  "amended_return_processing",
  "cancelled",
]);

/**
 * refund_status_history
 *
 * Append-only log of refund lifecycle events.  Never update or delete rows.
 * The latest row per (clientId, taxYear) represents the current status.
 */
export const refundStatusHistory = pgTable(
  "refund_status_history",
  {
    /** Surrogate primary key (UUID v4). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** FK to the client. */
    clientId: uuid("client_id").notNull(),

    /** Tax year this refund relates to (e.g. "2023"). */
    taxYear: varchar("tax_year", { length: 4 }).notNull(),

    /**
     * IRS / state tracking number (e.g. EFN for e-filed returns).
     * May be NULL until the return is accepted.
     */
    trackingNumber: varchar("tracking_number", { length: 100 }),

    /** Current refund status code. */
    status: refundStatusEnum("status").notNull(),

    /**
     * Dollar amount of the refund.  Stored as NUMERIC(12,2) to avoid
     * floating-point rounding issues.  NULL when unknown or not applicable.
     */
    refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }),

    /**
     * ISO 8601 date string for when the refund is expected to arrive
     * (e.g. "2024-02-15"). NULL if not yet determined.
     */
    expectedDepositDate: varchar("expected_deposit_date", { length: 10 }),

    /**
     * Human-readable message from the tax authority describing the status.
     * May contain guidance (e.g., "Your return is being processed…").
     */
    statusMessage: text("status_message"),

    /**
     * Raw JSON payload from the upstream tax authority API response.
     * Kept for audit and debugging; may contain provider-specific fields.
     */
    rawPayload: jsonb("raw_payload"),

    /**
     * Source system that reported this status change.
     * E.g. "irs_wmr_api", "state_dor_api", "manual_entry".
     */
    source: varchar("source", { length: 100 }).notNull().default("irs_wmr_api"),

    /** Timestamp when RTPS received / recorded this status event. */
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("idx_refund_status_client_year").on(table.clientId, table.taxYear),
    index("idx_refund_status_tracking").on(table.trackingNumber),
    index("idx_refund_status_recorded_at").on(table.recordedAt),
  ],
);

export type RefundStatusHistory = typeof refundStatusHistory.$inferSelect;
export type NewRefundStatusHistory = typeof refundStatusHistory.$inferInsert;
export type RefundStatus = (typeof refundStatusEnum.enumValues)[number];
