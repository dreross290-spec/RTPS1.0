/**
 * Core TypeScript types for the RTPS notification system.
 *
 * These are application-layer types used across integrations and the
 * notification engine.  They complement (and sometimes wrap) the Drizzle
 * schema types defined in drizzle/schema/.
 */

import type { RefundEventType } from "../../lib/constants/refund-events.js";

// ─── Re-export DB enum types ─────────────────────────────────────────────────

export type { RefundStatus } from "../../../drizzle/schema/refund-status.js";
export type { Channel, QueueStatus } from "../../../drizzle/schema/notification-queue.js";
export type {
  DeliveryStatus,
  Provider,
} from "../../../drizzle/schema/notification-audit.js";
export type { ConsentType } from "../../../drizzle/schema/tcpa-consent.js";
export type { NotificationFrequency } from "../../../drizzle/schema/notification-preferences.js";

// ─── IRS Integration Types ───────────────────────────────────────────────────

/** A single line-item entry on an IRS account transcript. */
export interface IRSTranscriptEntry {
  /** IRS transaction code (e.g. 150, 806, 846). */
  code: number;
  /** Date associated with this transaction (ISO 8601, YYYY-MM-DD). */
  date: string;
  /** Dollar amount (positive = credit, negative = debit). */
  amount?: number;
  /** Description of the transaction. */
  description?: string;
  /** IRS cycle date (YYYYWW format). */
  cycleDate?: string;
  /** Additional IRS-specific metadata. */
  metadata?: Record<string, unknown>;
}

/** Full IRS account transcript for a given EIN + tax year. */
export interface IRSTranscript {
  ein: string;
  taxYear: number;
  /** Date the return was e-filed or mailed. */
  filingDate?: string;
  /** All transaction code entries on the transcript. */
  entries: IRSTranscriptEntry[];
  /** Raw API response for audit/debugging. */
  rawData: Record<string, unknown>;
  /** Timestamp when this transcript was fetched from the IRS. */
  fetchedAt: string;
}

/** Parsed refund status derived from an IRS transcript. */
export interface IRSRefundStatus {
  ein: string;
  taxYear: number;
  /** IRS-level status string (before mapping to app RefundStatus). */
  irsStatus: string;
  /** Refund dollar amount in cents (or 0 if unknown). */
  refundAmountCents: number;
  /** Expected deposit date (ISO 8601 YYYY-MM-DD) or null. */
  expectedDepositDate: string | null;
  /** Payment method detected from transcript code 846. */
  paymentMethod: "direct_deposit" | "check" | null;
  /** IRS tracking/confirmation number. */
  trackingNumber: string | null;
  lastUpdated: string;
}

// ─── Refund Status / Event Types ─────────────────────────────────────────────

/** Represents a detected change in refund status that triggers notifications. */
export interface RefundStatusUpdate {
  clientId: string;
  taxYear: string;
  trackingNumber: string | null;
  previousStatus: import("../../../drizzle/schema/refund-status.js").RefundStatus | null;
  newStatus: import("../../../drizzle/schema/refund-status.js").RefundStatus;
  /** Formatted refund amount string, e.g. "$1,234.00". */
  refundAmount: string | null;
  /** Expected deposit date (ISO 8601 YYYY-MM-DD). */
  expectedDepositDate: string | null;
  statusMessage: string | null;
  paymentMethod: "direct_deposit" | "check" | null;
  /** The refund_status_history row ID that caused this update. */
  refundStatusHistoryId: string;
  recordedAt: Date;
}

/** A concrete event derived from a RefundStatusUpdate, ready for notification routing. */
export interface RefundStatusEvent {
  id: string;
  clientId: string;
  taxYear: string;
  eventType: RefundEventType;
  refundStatusUpdate: RefundStatusUpdate;
  /** Event data extracted for use in templates. */
  eventData: RefundEventData;
  /** Whether this event is mandatory (always deliver regardless of prefs). */
  isMandatory: boolean;
  detectedAt: Date;
}

/** Template variable data extracted from a RefundStatusUpdate. */
export interface RefundEventData {
  clientId: string;
  /** Client's first name for personalization (or "Taxpayer" as fallback). */
  firstName: string;
  taxYear: string;
  refundAmount: string | null;
  /** Human-readable expected deposit date, e.g. "Feb 15, 2024". */
  expectedDate: string | null;
  /** Rejection or review reason. */
  reason: string | null;
  /** Additional info description needed by IRS. */
  infoNeeded: string | null;
  /** Deadline for additional info. */
  deadline: string | null;
  /** Offset amount applied. */
  offsetAmount: string | null;
  /** Net refund after offset. */
  netAmount: string | null;
  paymentMethod: "direct_deposit" | "check" | null;
  /** Portal deep-link URL for the client to check status. */
  portalUrl: string;
}

/** Anomaly flags detected during status change parsing. */
export interface StatusAnomaly {
  type: "amount_change" | "reversal" | "delay" | "unexpected_transition";
  description: string;
  severity: "low" | "medium" | "high";
}

// ─── Notification Preferences ────────────────────────────────────────────────

/** Application-layer notification preferences for a client. */
export interface NotificationPreferences {
  id: string;
  clientId: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
  /** UTC hour 0-23 for start of preferred contact window. */
  preferredContactHoursStart: number;
  /** UTC hour 0-23 for end of preferred contact window (exclusive). */
  preferredContactHoursEnd: number;
  notificationFrequency: "realtime" | "daily_digest" | "weekly";
  /** AES-256-GCM encrypted phone number (stored format). */
  encryptedPhone: string | null;
  /** AES-256-GCM encrypted email address (stored format). */
  encryptedEmail: string | null;
  /** Per-event-type opt-in flags. */
  eventTypePreferences: Record<string, boolean>;
}

// ─── TCPA Consent ────────────────────────────────────────────────────────────

/** TCPA consent record (application-layer view). */
export interface TCPAConsent {
  id: string;
  clientId: string;
  /** Masked phone number (e.g. "+1******7890"). */
  maskedPhone: string;
  consentDate: Date;
  consentType: "express_written" | "express_verbal" | "prior_business";
  consentDocument: string | null;
  revokedAt: Date | null;
  revokedReason: string | null;
}

// ─── Notification Event / Queue ──────────────────────────────────────────────

/** Represents a fully-resolved notification ready to be queued. */
export interface NotificationEvent {
  clientId: string;
  refundStatusHistoryId: string;
  channel: "sms" | "email";
  eventType: RefundEventType;
  /** Rendered content snapshot for audit (no raw PII). */
  renderedContent: string;
  /** Suppression reason if the notification is suppressed. */
  suppressionReason: string | null;
}

/** An item in the outbound notification queue. */
export interface NotificationQueueItem {
  id: string;
  notificationEventId: string;
  clientId: string;
  channel: "sms" | "email";
  /** Channel-specific payload (phone/email encrypted inside). */
  payload: SmsQueuePayload | EmailQueuePayload;
  status: import("../../../drizzle/schema/notification-queue.js").QueueStatus;
  attemptCount: number;
  maxRetries: number;
  scheduledFor: Date | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

/** SMS-specific queue payload (stored as JSONB). */
export interface SmsQueuePayload {
  type: "sms";
  /** AES-256-GCM encrypted recipient phone number. */
  toEncrypted: string;
  body: string;
}

/** Email-specific queue payload (stored as JSONB). */
export interface EmailQueuePayload {
  type: "email";
  /** AES-256-GCM encrypted recipient email address. */
  toEncrypted: string;
  templateId: string;
  dynamicTemplateData: Record<string, unknown>;
  subject: string;
  categories?: string[];
}

// ─── SMS Types ───────────────────────────────────────────────────────────────

/** SMS template descriptor. */
export interface SMSTemplate {
  eventType: RefundEventType;
  /** Raw template body (before variable substitution). */
  bodyTemplate: string;
  /** Whether this template produces a multipart SMS (>160 chars). */
  isMultipart: boolean;
}

/** Result of sending an SMS via Twilio. */
export interface TwilioSendResult {
  messageSid: string;
  status: string;
  to: string;
  from: string;
  price: string | null;
  priceUnit: string | null;
  errorCode: number | null;
  errorMessage: string | null;
}

/** Inbound Twilio webhook payload (status callback or incoming message). */
export interface TwilioWebhookPayload {
  MessageSid: string;
  SmsSid?: string;
  AccountSid?: string;
  MessagingServiceSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  MessageStatus?: string;
  SmsStatus?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  NumSegments?: string;
  ApiVersion?: string;
}

// ─── Email Types ─────────────────────────────────────────────────────────────

/** Email template descriptor with versioning. */
export interface EmailTemplate {
  eventType: RefundEventType;
  templateId: string;
  defaultSubject: string;
  categories: string[];
  /** Semantic version of this template configuration. */
  version: string;
  /** ISO 8601 date of last update. */
  updatedAt: string;
}

/** Rendered email content ready to send. */
export interface EmailContent {
  templateId: string;
  subject: string;
  /** Template data for SendGrid dynamic template substitution. */
  dynamicTemplateData: Record<string, unknown>;
  categories: string[];
  /** CAN-SPAM compliant unsubscribe URL. */
  unsubscribeUrl: string;
  /** Plain-text unsubscribe link text. */
  unsubscribeText: string;
}

/** Single recipient for a bulk email send. */
export interface EmailRecipient {
  /** AES-256-GCM encrypted email address. */
  toEncrypted: string;
  templateId: string;
  dynamicTemplateData: Record<string, unknown>;
  subject: string;
}

/** Result of sending an email via SendGrid. */
export interface SendGridSendResult {
  messageId: string;
  statusCode: number;
}

/** Inbound SendGrid webhook event (one event in an array payload). */
export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: string;
  sg_message_id?: string;
  sg_event_id?: string;
  reason?: string;
  status?: string;
  type?: string;
  url?: string;
  ip?: string;
  useragent?: string;
  asm_group_id?: number;
  category?: string | string[];
  response?: string;
  attempt?: string;
}

// ─── IRS Polling Types ───────────────────────────────────────────────────────

/** Configuration for the transcript polling scheduler. */
export interface PollingConfig {
  /** Cron expression for polling "hot" returns filed within hotReturnThresholdHours. */
  hotReturnCronExpression: string;
  /** Cron expression for routine daily polling. */
  routineCronExpression: string;
  /** Returns filed within this many hours are considered "hot" and polled more frequently. */
  hotReturnThresholdHours: number;
  /** Max consecutive failures before a return is de-prioritized. */
  maxConsecutiveFailures: number;
  /** Timeout in milliseconds for each IRS API call. */
  requestTimeoutMs: number;
}

/** Current state of the transcript poller. */
export interface PollingStatus {
  isRunning: boolean;
  lastHotPollTime: Date | null;
  lastRoutinePollTime: Date | null;
  activeJobCount: number;
  /** Map of returnId → consecutive failure count. */
  consecutiveFailures: Map<string, number>;
  /** Total polls performed since last start. */
  totalPollCount: number;
}

// ─── Compliance Types ────────────────────────────────────────────────────────

/** Result of a TCPA or CAN-SPAM compliance check. */
export interface ComplianceResult {
  compliant: boolean;
  /** Human-readable suppression reason (populated when compliant = false). */
  reason?: string;
  /** Active consent record ID if compliant via TCPA. */
  consentId?: string;
}

// ─── Audit Types ─────────────────────────────────────────────────────────────

/** Masked recipient data for audit log entries (no raw PII). */
export interface MaskedRecipient {
  channel: "sms" | "email";
  /** Masked phone number (e.g. "+1******1234") for SMS. */
  maskedPhone?: string;
  /** Masked email address (e.g. "j***@example.com") for email. */
  maskedEmail?: string;
}
