/**
 * Zod schemas for refund status data
 *
 * Used to validate inbound status updates from IRS/state APIs before they are
 * written to refund_status_history.
 */

import { z } from "zod";

/** All valid refund status codes (mirrors the DB enum). */
export const refundStatusSchema = z.enum([
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

export type RefundStatusCode = z.infer<typeof refundStatusSchema>;

/**
 * Schema for creating a new refund status history record.
 */
export const createRefundStatusSchema = z.object({
  /** Client UUID. */
  clientId: z.string().uuid(),

  /** 4-digit tax year string. */
  taxYear: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, "taxYear must be a 4-digit year string"),

  /** Optional IRS tracking number (EFN). */
  trackingNumber: z.string().max(100).optional(),

  /** New refund status. */
  status: refundStatusSchema,

  /**
   * Refund dollar amount as a numeric string with up to 2 decimal places.
   * E.g. "1234.56".
   */
  refundAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "refundAmount must be a numeric string with up to 2 decimal places")
    .optional(),

  /** Expected deposit date in ISO 8601 format (YYYY-MM-DD). */
  expectedDepositDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expectedDepositDate must be YYYY-MM-DD")
    .optional(),

  /** Human-readable status message from the tax authority. */
  statusMessage: z.string().max(2000).optional(),

  /** Raw JSON payload from the upstream API response. */
  rawPayload: z.record(z.unknown()).optional(),

  /** Source system that reported this status. */
  source: z.string().max(100).default("irs_wmr_api"),
});

export type CreateRefundStatus = z.infer<typeof createRefundStatusSchema>;

/**
 * Schema for a refund status history record as read from the database.
 */
export const refundStatusHistorySchema = createRefundStatusSchema.extend({
  id: z.string().uuid(),
  recordedAt: z.date(),
});

export type RefundStatusHistoryRecord = z.infer<typeof refundStatusHistorySchema>;

/**
 * Schema for querying refund status history.
 */
export const refundStatusQuerySchema = z.object({
  clientId: z.string().uuid(),
  taxYear: z
    .string()
    .length(4)
    .regex(/^\d{4}$/)
    .optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export type RefundStatusQuery = z.infer<typeof refundStatusQuerySchema>;

/**
 * Schema for the "current status" summary returned by the API.
 */
export const currentRefundStatusSchema = z.object({
  clientId: z.string().uuid(),
  taxYear: z.string().length(4),
  status: refundStatusSchema,
  refundAmount: z.string().nullable(),
  expectedDepositDate: z.string().nullable(),
  statusMessage: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  recordedAt: z.date(),
});

export type CurrentRefundStatus = z.infer<typeof currentRefundStatusSchema>;
