/**
 * Zod schemas for notification preferences
 *
 * Used to validate input when clients create or update their notification
 * preferences (opt-in/out, contact hours, frequency, contact details).
 */

import { z } from "zod";
import { ALL_REFUND_EVENT_TYPES } from "../constants/refund-events.js";

/** Hour integer constraint (0–23). */
const hourSchema = z.number().int().min(0).max(23);

/**
 * Event type preferences map: RefundEventType → boolean.
 * The schema allows any string key mapped to a boolean, but we validate
 * that keys are known event types in the application layer.
 */
const eventTypePreferencesSchema = z
  .record(z.boolean())
  .refine(
    (prefs) => {
      const validKeys = new Set<string>(ALL_REFUND_EVENT_TYPES);
      return Object.keys(prefs).every((k) => validKeys.has(k));
    },
    {
      message: `eventTypePreferences keys must be valid RefundEventType values: ${ALL_REFUND_EVENT_TYPES.join(", ")}`,
    },
  );

/**
 * Schema for creating notification preferences.
 */
export const createNotificationPreferenceSchema = z
  .object({
    /** Client UUID (from authentication context). */
    clientId: z.string().uuid(),

    smsEnabled: z.boolean().default(false),

    emailEnabled: z.boolean().default(true),

    /**
     * Start hour for the preferred contact window (0–23 UTC).
     * Defaults to 8 (8 AM UTC).
     */
    preferredContactHoursStart: hourSchema.default(8),

    /**
     * End hour for the preferred contact window (0–23 UTC, exclusive).
     * Defaults to 21 (9 PM UTC).
     */
    preferredContactHoursEnd: hourSchema.default(21),

    notificationFrequency: z
      .enum(["realtime", "daily_digest", "weekly"])
      .default("realtime"),

    /**
     * Raw (unencrypted) phone number. Will be validated and encrypted
     * before storage. Required when smsEnabled = true.
     */
    phoneNumber: z
      .string()
      .min(7)
      .max(20)
      .optional(),

    /**
     * Raw (unencrypted) email address. Will be validated and encrypted
     * before storage. Required when emailEnabled = true.
     */
    emailAddress: z
      .string()
      .email("Must be a valid email address")
      .optional(),

    eventTypePreferences: eventTypePreferencesSchema.optional(),
  })
  .refine(
    (data) =>
      !data.smsEnabled || (data.phoneNumber !== undefined && data.phoneNumber.length > 0),
    {
      message: "phoneNumber is required when smsEnabled is true.",
      path: ["phoneNumber"],
    },
  )
  .refine(
    (data) =>
      !data.emailEnabled ||
      (data.emailAddress !== undefined && data.emailAddress.length > 0),
    {
      message: "emailAddress is required when emailEnabled is true.",
      path: ["emailAddress"],
    },
  )
  .refine(
    (data) => data.preferredContactHoursStart !== data.preferredContactHoursEnd,
    {
      message: "preferredContactHoursStart and preferredContactHoursEnd must differ.",
      path: ["preferredContactHoursEnd"],
    },
  );

export type CreateNotificationPreference = z.infer<
  typeof createNotificationPreferenceSchema
>;

/**
 * Schema for updating notification preferences (all fields optional).
 */
export const updateNotificationPreferenceSchema = z
  .object({
    smsEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    preferredContactHoursStart: hourSchema.optional(),
    preferredContactHoursEnd: hourSchema.optional(),
    notificationFrequency: z
      .enum(["realtime", "daily_digest", "weekly"])
      .optional(),
    phoneNumber: z.string().min(7).max(20).optional(),
    emailAddress: z.string().email().optional(),
    eventTypePreferences: eventTypePreferencesSchema.optional(),
  })
  .refine(
    (data) => {
      const start = data.preferredContactHoursStart;
      const end = data.preferredContactHoursEnd;
      if (start !== undefined && end !== undefined) return start !== end;
      return true;
    },
    {
      message: "preferredContactHoursStart and preferredContactHoursEnd must differ when both are provided.",
      path: ["preferredContactHoursEnd"],
    },
  );

export type UpdateNotificationPreference = z.infer<
  typeof updateNotificationPreferenceSchema
>;

/**
 * Schema for the preference record as returned to the client (no encrypted PII).
 */
export const notificationPreferenceResponseSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  smsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  preferredContactHoursStart: z.number().int(),
  preferredContactHoursEnd: z.number().int(),
  notificationFrequency: z.enum(["realtime", "daily_digest", "weekly"]),
  /** Masked phone number for display. */
  maskedPhone: z.string().nullable(),
  /** Masked email for display. */
  maskedEmail: z.string().nullable(),
  eventTypePreferences: z.record(z.boolean()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type NotificationPreferenceResponse = z.infer<
  typeof notificationPreferenceResponseSchema
>;
