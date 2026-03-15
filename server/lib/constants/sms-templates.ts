/**
 * SMS template strings
 *
 * Each template is a function that accepts a strongly-typed variables object
 * and returns the final message body string.  Messages must stay under 160
 * characters (single SMS segment) where possible; multi-segment messages are
 * noted.
 *
 * Variable names inside templates follow the {{variableName}} convention used
 * by the renderer, but these factory functions bypass the renderer for
 * type-safety.
 *
 * Opt-out footer ("Reply STOP to unsubscribe") is appended by the SMS sender
 * layer and MUST NOT be included here – it is added once per message
 * programmatically to ensure consistent compliance wording.
 */

import type { RefundEventType } from "../constants/refund-events.js";

/** Variables common to all SMS templates. */
export interface SmsTemplateBaseVars {
  /** Client's first name (or "Taxpayer" as fallback). */
  firstName: string;
  /** Tax year the update relates to, e.g. "2023". */
  taxYear: string;
}

/** Template-specific variable shapes. */
export interface SmsReturnReceivedVars extends SmsTemplateBaseVars {}

export interface SmsReturnProcessingVars extends SmsTemplateBaseVars {}

export interface SmsRefundApprovedVars extends SmsTemplateBaseVars {
  /** Formatted refund amount, e.g. "$1,234.00". */
  refundAmount: string;
  /** Expected deposit date, e.g. "Feb 15, 2024". */
  expectedDate: string;
}

export interface SmsRefundSentVars extends SmsTemplateBaseVars {
  refundAmount: string;
  expectedDate: string;
}

export interface SmsRefundDepositedVars extends SmsTemplateBaseVars {
  refundAmount: string;
}

export interface SmsRefundRejectedVars extends SmsTemplateBaseVars {
  /** Short rejection reason or guidance. */
  reason: string;
}

export interface SmsAdditionalInfoVars extends SmsTemplateBaseVars {
  /** What information is needed. */
  infoNeeded: string;
  /** Deadline by which information is required, e.g. "Mar 1, 2024". */
  deadline: string;
}

export interface SmsUnderReviewVars extends SmsTemplateBaseVars {}

export interface SmsOffsetAppliedVars extends SmsTemplateBaseVars {
  refundAmount: string;
  /** Offset amount, e.g. "$300.00". */
  offsetAmount: string;
  /** Net amount after offset. */
  netAmount: string;
}

export interface SmsAmendedReturnVars extends SmsTemplateBaseVars {}

export interface SmsCancelledVars extends SmsTemplateBaseVars {}

/** Union of all SMS variable types. */
export type SmsTemplateVars =
  | SmsReturnReceivedVars
  | SmsReturnProcessingVars
  | SmsRefundApprovedVars
  | SmsRefundSentVars
  | SmsRefundDepositedVars
  | SmsRefundRejectedVars
  | SmsAdditionalInfoVars
  | SmsUnderReviewVars
  | SmsOffsetAppliedVars
  | SmsAmendedReturnVars
  | SmsCancelledVars;

/** Type-safe SMS template map keyed by RefundEventType. */
export const SMS_TEMPLATES = {
  RETURN_RECEIVED: (v: SmsReturnReceivedVars): string =>
    `Hi ${v.firstName}, the IRS has received your ${v.taxYear} tax return. We'll keep you updated as it's processed.`,

  RETURN_PROCESSING: (v: SmsReturnProcessingVars): string =>
    `Hi ${v.firstName}, your ${v.taxYear} tax return is being processed by the IRS. No action needed at this time.`,

  REFUND_APPROVED: (v: SmsRefundApprovedVars): string =>
    `Great news, ${v.firstName}! Your ${v.taxYear} federal refund of ${v.refundAmount} has been approved. Expected deposit: ${v.expectedDate}.`,

  REFUND_SENT: (v: SmsRefundSentVars): string =>
    `Hi ${v.firstName}, your ${v.taxYear} refund of ${v.refundAmount} has been sent. Expected in your account by ${v.expectedDate}.`,

  REFUND_DEPOSITED: (v: SmsRefundDepositedVars): string =>
    `Hi ${v.firstName}, your ${v.taxYear} refund of ${v.refundAmount} has been deposited into your account. `,

  REFUND_REJECTED: (v: SmsRefundRejectedVars): string =>
    `Action required: Your ${v.taxYear} refund was rejected. Reason: ${v.reason}. Please log in to take action.`,

  ADDITIONAL_INFO_REQUIRED: (v: SmsAdditionalInfoVars): string =>
    `The IRS needs more info for your ${v.taxYear} return (${v.infoNeeded}) by ${v.deadline}. Log in for details.`,

  UNDER_REVIEW: (v: SmsUnderReviewVars): string =>
    `Hi ${v.firstName}, your ${v.taxYear} return is under IRS review. This is normal; we'll update you when complete.`,

  OFFSET_APPLIED: (v: SmsOffsetAppliedVars): string =>
    `Hi ${v.firstName}, ${v.offsetAmount} was offset from your ${v.taxYear} refund. Net refund: ${v.netAmount}. Log in for details.`,

  AMENDED_RETURN_PROCESSING: (v: SmsAmendedReturnVars): string =>
    `Hi ${v.firstName}, the IRS is processing your ${v.taxYear} amended return. Processing can take up to 16 weeks.`,

  CANCELLED: (v: SmsCancelledVars): string =>
    `Hi ${v.firstName}, your ${v.taxYear} refund request has been cancelled. Please log in or contact us for assistance.`,
} as const satisfies Record<RefundEventType, (vars: never) => string>;

/** Mandatory TCPA opt-out footer appended to every outbound SMS. */
export const SMS_OPT_OUT_FOOTER = "Reply STOP to unsubscribe.";

/** Maximum safe single-segment SMS length (GSM-7 encoding). */
export const SMS_MAX_SINGLE_SEGMENT_LENGTH = 160;

/**
 * Appends the opt-out footer to a message body, ensuring a newline separator.
 * This must be called by the SMS sending layer before submission to Twilio.
 */
export function appendOptOutFooter(body: string): string {
  return `${body}\n${SMS_OPT_OUT_FOOTER}`;
}
