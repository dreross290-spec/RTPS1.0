/**
 * Zod schemas for notification payloads
 *
 * These schemas validate the data flowing into the notification dispatch layer.
 */

import { z } from "zod";
import { ALL_REFUND_EVENT_TYPES } from "../constants/refund-events.js";

/** Validated notification channel. */
export const channelSchema = z.enum(["sms", "email"]);

/** Validated notification frequency. */
export const notificationFrequencySchema = z.enum([
  "realtime",
  "daily_digest",
  "weekly",
]);

/** Validated queue/delivery status. */
export const queueStatusSchema = z.enum([
  "pending",
  "processing",
  "sent",
  "delivered",
  "failed",
  "suppressed",
  "scheduled",
]);

/**
 * Schema for the base notification trigger payload.
 * This is what the refund-status service emits when a status change occurs.
 */
export const notificationTriggerSchema = z.object({
  /** Client identifier (UUID). */
  clientId: z.string().uuid(),

  /** FK to the refund_status_history row that caused this trigger. */
  refundStatusHistoryId: z.string().uuid(),

  /** The refund event type. */
  eventType: z.enum(ALL_REFUND_EVENT_TYPES as [string, ...string[]]),

  /** Tax year string, e.g. "2023". */
  taxYear: z.string().length(4).regex(/^\d{4}$/),

  /** Optional formatted refund amount (e.g. "$1,234.00"). */
  refundAmount: z.string().optional(),

  /** Optional expected deposit date (ISO 8601 or human-readable). */
  expectedDepositDate: z.string().optional(),

  /** Optional rejection/review reason. */
  reason: z.string().max(500).optional(),

  /** Optional additional information detail. */
  additionalInfo: z.string().max(500).optional(),

  /** Optional deadline string. */
  deadline: z.string().optional(),

  /** Optional offset amount. */
  offsetAmount: z.string().optional(),

  /** Optional net refund amount after offset. */
  netAmount: z.string().optional(),
});

export type NotificationTrigger = z.infer<typeof notificationTriggerSchema>;

/** SMS queue payload stored as JSONB in notification_queue.payload. */
export const smsQueuePayloadSchema = z.object({
  /** Encrypted recipient phone number (E.164 before encryption). */
  toEncrypted: z.string().min(1),

  /** Rendered SMS message body (no raw PII). */
  body: z.string().min(1).max(1600),
});

export type SmsQueuePayload = z.infer<typeof smsQueuePayloadSchema>;

/** Email queue payload stored as JSONB in notification_queue.payload. */
export const emailQueuePayloadSchema = z.object({
  /** Encrypted recipient email address. */
  toEncrypted: z.string().min(1),

  /** SendGrid Dynamic Template ID. */
  templateId: z.string().startsWith("d-"),

  /** Template variable substitution data (no raw PII). */
  dynamicTemplateData: z.record(z.unknown()),

  /** Email subject line (may include resolved variables). */
  subject: z.string().min(1).max(998),

  /** SendGrid categories for analytics. */
  categories: z.array(z.string()).optional(),
});

export type EmailQueuePayload = z.infer<typeof emailQueuePayloadSchema>;

/** Generic notification dispatch request (internal API). */
export const dispatchNotificationSchema = z.object({
  /** Which channel to use. */
  channel: channelSchema,

  /** Notification event ID from notification_events table. */
  notificationEventId: z.string().uuid(),

  /** Client identifier. */
  clientId: z.string().uuid(),

  /** Channel-specific payload. */
  payload: z.union([smsQueuePayloadSchema, emailQueuePayloadSchema]),

  /** Optional: when to send (for digest/scheduled modes). */
  scheduledFor: z.date().optional(),

  /** Max retries override. */
  maxRetries: z.number().int().min(0).max(10).default(3),
});

export type DispatchNotification = z.infer<typeof dispatchNotificationSchema>;

/** Twilio delivery status callback payload schema. */
export const twilioStatusCallbackSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.enum([
    "accepted",
    "queued",
    "sending",
    "sent",
    "delivered",
    "undelivered",
    "failed",
    "canceled",
    "read",
    "scheduled",
  ]),
  To: z.string().optional(),
  From: z.string().optional(),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
  AccountSid: z.string().optional(),
  SmsSid: z.string().optional(),
});

export type TwilioStatusCallback = z.infer<typeof twilioStatusCallbackSchema>;

/** SendGrid inbound webhook event schema. */
export const sendGridEventSchema = z.object({
  email: z.string().email(),
  timestamp: z.number().int(),
  event: z.enum([
    "delivered",
    "open",
    "click",
    "bounce",
    "spam_report",
    "unsubscribe",
    "deferred",
    "dropped",
    "processed",
  ]),
  sg_message_id: z.string().optional(),
  sg_event_id: z.string().optional(),
  reason: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  url: z.string().optional(),
  ip: z.string().optional(),
  useragent: z.string().optional(),
  asm_group_id: z.number().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
});

export type SendGridEvent = z.infer<typeof sendGridEventSchema>;

/** Array of SendGrid events (their webhook sends batches). */
export const sendGridWebhookPayloadSchema = z.array(sendGridEventSchema);

export type SendGridWebhookPayload = z.infer<typeof sendGridWebhookPayloadSchema>;
