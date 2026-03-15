/**
 * Zod schemas for TCPA consent records
 *
 * Used to validate input when capturing or revoking TCPA express written consent.
 */

import { z } from "zod";

/** Valid consent capture methods. */
export const consentTypeSchema = z.enum([
  "express_written",
  "express_verbal",
  "prior_business",
]);

export type ConsentTypeValue = z.infer<typeof consentTypeSchema>;

/**
 * Schema for capturing new TCPA consent.
 */
export const createTcpaConsentSchema = z.object({
  /** Client UUID. */
  clientId: z.string().uuid(),

  /**
   * Raw phone number (will be masked before storage).
   * Must be a valid US/Canada phone number.
   */
  phoneNumber: z
    .string()
    .min(10)
    .max(20)
    .regex(
      /^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
      "phoneNumber must be a valid NANP phone number",
    ),

  /** Type of consent obtained. */
  consentType: consentTypeSchema,

  /**
   * Proof-of-consent document.  Examples:
   *   - URL to stored opt-in form submission
   *   - Recording transcript ID
   *   - JSON object with capture details
   */
  consentDocument: z.string().max(4096).optional(),

  /**
   * Explicit consent capture timestamp. Defaults to now() when omitted.
   * Must not be in the future.
   */
  consentDate: z
    .date()
    .refine((d) => d <= new Date(), {
      message: "consentDate must not be in the future.",
    })
    .optional(),
});

export type CreateTcpaConsent = z.infer<typeof createTcpaConsentSchema>;

/**
 * Schema for revoking (opt-out) an existing consent record.
 */
export const revokeTcpaConsentSchema = z.object({
  /** UUID of the tcpa_consent row to revoke. */
  consentId: z.string().uuid(),

  /** Human-readable reason for revocation. */
  revokedReason: z
    .string()
    .min(1)
    .max(500)
    .default("User requested opt-out"),
});

export type RevokeTcpaConsent = z.infer<typeof revokeTcpaConsentSchema>;

/**
 * Schema for a TCPA consent record as read from the database.
 */
export const tcpaConsentRecordSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  /** Masked phone number (e.g. "+1******7890"). */
  phoneNumber: z.string(),
  consentDate: z.date(),
  consentType: consentTypeSchema,
  consentDocument: z.string().nullable(),
  revokedAt: z.date().nullable(),
  revokedReason: z.string().nullable(),
  createdAt: z.date(),
});

export type TcpaConsentRecord = z.infer<typeof tcpaConsentRecordSchema>;

/**
 * Schema for checking whether a client has active consent.
 */
export const consentStatusSchema = z.object({
  clientId: z.string().uuid(),
  /** Masked phone number to check. */
  maskedPhone: z.string(),
  hasActiveConsent: z.boolean(),
  /** The most recent active consent record, if any. */
  latestConsent: tcpaConsentRecordSchema.nullable(),
});

export type ConsentStatus = z.infer<typeof consentStatusSchema>;

/**
 * Schema for TCPA consent query parameters.
 */
export const tcpaConsentQuerySchema = z.object({
  clientId: z.string().uuid(),
  includeRevoked: z.boolean().default(false),
});

export type TcpaConsentQuery = z.infer<typeof tcpaConsentQuerySchema>;
