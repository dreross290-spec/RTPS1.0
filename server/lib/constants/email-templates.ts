/**
 * Email template configuration
 *
 * Maps each RefundEventType to a SendGrid Dynamic Template ID and default
 * subject line.  Dynamic template data variable names align with the
 * EmailTemplateVars interface.
 *
 * Template IDs use the "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" format from
 * SendGrid's Template Engine.  Replace placeholder IDs with real template IDs
 * from your SendGrid account before deploying.
 */

import type { RefundEventType } from "./refund-events.js";

/** Shape of a single email template configuration entry. */
export interface EmailTemplateConfig {
  /** SendGrid Dynamic Template ID. */
  templateId: string;
  /** Default email subject (used as fallback / plain-text subject). */
  defaultSubject: string;
  /** SendGrid category tags for analytics grouping. */
  categories: string[];
}

/**
 * Map of RefundEventType → SendGrid template configuration.
 *
 * IMPORTANT: Replace placeholder template IDs ("d-000…") with real IDs from
 * your SendGrid account's Dynamic Templates section.
 */
export const EMAIL_TEMPLATES: Readonly<Record<RefundEventType, EmailTemplateConfig>> = {
  RETURN_RECEIVED: {
    templateId: "d-00000000000000000000000000000001",
    defaultSubject: "We've received your {{taxYear}} tax return",
    categories: ["tax-notifications", "return-received"],
  },
  RETURN_PROCESSING: {
    templateId: "d-00000000000000000000000000000002",
    defaultSubject: "Your {{taxYear}} tax return is being processed",
    categories: ["tax-notifications", "return-processing"],
  },
  REFUND_APPROVED: {
    templateId: "d-00000000000000000000000000000003",
    defaultSubject: "Your {{taxYear}} refund of {{refundAmount}} has been approved!",
    categories: ["tax-notifications", "refund-approved"],
  },
  REFUND_SENT: {
    templateId: "d-00000000000000000000000000000004",
    defaultSubject: "Your {{taxYear}} refund has been sent",
    categories: ["tax-notifications", "refund-sent"],
  },
  REFUND_DEPOSITED: {
    templateId: "d-00000000000000000000000000000005",
    defaultSubject: "Your {{taxYear}} refund has been deposited",
    categories: ["tax-notifications", "refund-deposited"],
  },
  REFUND_REJECTED: {
    templateId: "d-00000000000000000000000000000006",
    defaultSubject: "Action Required: Your {{taxYear}} refund has been rejected",
    categories: ["tax-notifications", "refund-rejected", "action-required"],
  },
  ADDITIONAL_INFO_REQUIRED: {
    templateId: "d-00000000000000000000000000000007",
    defaultSubject: "Action Required: Additional information needed for your {{taxYear}} return",
    categories: ["tax-notifications", "additional-info", "action-required"],
  },
  UNDER_REVIEW: {
    templateId: "d-00000000000000000000000000000008",
    defaultSubject: "Your {{taxYear}} tax return is under review",
    categories: ["tax-notifications", "under-review"],
  },
  OFFSET_APPLIED: {
    templateId: "d-00000000000000000000000000000009",
    defaultSubject: "A debt offset was applied to your {{taxYear}} refund",
    categories: ["tax-notifications", "offset-applied"],
  },
  AMENDED_RETURN_PROCESSING: {
    templateId: "d-00000000000000000000000000000010",
    defaultSubject: "Your {{taxYear}} amended return is being processed",
    categories: ["tax-notifications", "amended-return"],
  },
  CANCELLED: {
    templateId: "d-00000000000000000000000000000011",
    defaultSubject: "Your {{taxYear}} refund request has been cancelled",
    categories: ["tax-notifications", "cancelled"],
  },
} as const;

/**
 * Global SendGrid mail settings applied to every outbound message.
 */
export const EMAIL_GLOBAL_SETTINGS = {
  /** Sender name shown in "From" field. Falls back to env var SENDGRID_FROM_NAME. */
  fromName: process.env["SENDGRID_FROM_NAME"] ?? "Tax Refund Updates",
  /** Sender address. Falls back to env var SENDGRID_FROM_EMAIL. */
  fromEmail: process.env["SENDGRID_FROM_EMAIL"] ?? "noreply@example.com",
  /**
   * Reply-to address (separate from sender so auto-replies don't flood the
   * sending mailbox).
   */
  replyTo: process.env["SENDGRID_REPLY_TO_EMAIL"] ?? "support@example.com",
  /**
   * ASM (Advanced Suppression Manager) group ID for CAN-SPAM unsubscribe
   * management.  Set this to your SendGrid unsubscribe group ID.
   */
  asmGroupId: parseInt(process.env["SENDGRID_ASM_GROUP_ID"] ?? "0", 10) || 0,
  /**
   * IP pool name for sending (optional – useful for dedicated IPs).
   */
  ipPoolName: process.env["SENDGRID_IP_POOL"] ?? undefined,
} as const;

/** SendGrid event types we handle in the inbound webhook. */
export const SENDGRID_TRACKED_EVENTS = [
  "delivered",
  "open",
  "click",
  "bounce",
  "spam_report",
  "unsubscribe",
  "deferred",
  "dropped",
] as const;

export type SendGridTrackedEvent = (typeof SENDGRID_TRACKED_EVENTS)[number];
