/**
 * SMS Message Formatter
 *
 * Formats outbound SMS messages using pre-defined templates, enforces the
 * 160-character single-segment limit (flags multi-part), appends the TCPA
 * opt-out footer, and generates portal short-links for each notification.
 */

import { SMS_TEMPLATES, SMS_OPT_OUT_FOOTER, SMS_MAX_SINGLE_SEGMENT_LENGTH } from "../../../lib/constants/sms-templates.js";
import type { RefundEventType } from "../../../lib/constants/refund-events.js";
import type { RefundEventData, SMSTemplate } from "../../notifications/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormattedSMS {
  /** Final message body with opt-out footer. */
  body: string;
  /** Whether this message exceeds 160 chars (multipart billing). */
  isMultipart: boolean;
  /** Number of SMS segments (160 chars each for GSM-7). */
  segmentCount: number;
  /** Character count of the final body. */
  charCount: number;
}

/** Validation result for a formatted message. */
export interface SMSValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max GSM-7 characters per segment in a concatenated SMS. */
const MULTIPART_SEGMENT_LENGTH = 153;

/** Base portal URL for short-links. */
const PORTAL_BASE_URL = process.env["PORTAL_BASE_URL"] ?? "https://app.example.com";

// ─── Formatter ────────────────────────────────────────────────────────────────

/**
 * Formats an SMS for the given event type using template data.
 * Appends the TCPA opt-out footer and generates a portal short-link.
 */
export function formatSMS(
  eventType: RefundEventType,
  data: RefundEventData,
): FormattedSMS {
  const templateFn = SMS_TEMPLATES[eventType];

  // Build template variables from event data
  const vars = buildTemplateVars(eventType, data);

  // Call the template function – cast required due to union type in SMS_TEMPLATES
  const rawBody = (templateFn as (v: typeof vars) => string)(vars);

  // Append portal link
  const portalLink = buildPortalLink(data.clientId, data.taxYear);
  const bodyWithLink = rawBody.includes(PORTAL_BASE_URL)
    ? rawBody
    : `${rawBody} ${portalLink}`;

  // Append TCPA opt-out footer
  const finalBody = `${bodyWithLink}\n${SMS_OPT_OUT_FOOTER}`;

  const charCount = finalBody.length;
  const isMultipart = charCount > SMS_MAX_SINGLE_SEGMENT_LENGTH;
  const segmentCount = isMultipart
    ? Math.ceil(charCount / MULTIPART_SEGMENT_LENGTH)
    : 1;

  return { body: finalBody, isMultipart, segmentCount, charCount };
}

/**
 * Validates a formatted SMS body for compliance and deliverability.
 */
export function validateFormattedSMS(body: string): SMSValidationResult {
  const errors: string[] = [];

  if (!body || body.trim().length === 0) {
    errors.push("SMS body must not be empty.");
  }

  if (!body.includes("STOP")) {
    errors.push("SMS body must include STOP opt-out instruction for TCPA compliance.");
  }

  // Max SMS payload: 1600 chars (10 segments × 160 chars)
  if (body.length > 1600) {
    errors.push(`SMS body exceeds maximum length of 1600 characters (got ${body.length}).`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Returns the SMSTemplate descriptor for an event type (metadata only).
 */
export function getSMSTemplate(eventType: RefundEventType): SMSTemplate {
  return {
    eventType,
    bodyTemplate: `{{${eventType}_template}}`,
    isMultipart: false,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TemplateVars {
  firstName: string;
  taxYear: string;
  refundAmount: string;
  expectedDate: string;
  reason: string;
  infoNeeded: string;
  deadline: string;
  offsetAmount: string;
  netAmount: string;
}

function buildTemplateVars(eventType: RefundEventType, data: RefundEventData): TemplateVars {
  return {
    firstName: data.firstName || "Taxpayer",
    taxYear: data.taxYear,
    refundAmount: data.refundAmount ?? "$0.00",
    expectedDate: data.expectedDate ?? "TBD",
    reason: data.reason ?? "Please log in for details.",
    infoNeeded: data.infoNeeded ?? "additional documentation",
    deadline: data.deadline ?? "as soon as possible",
    offsetAmount: data.offsetAmount ?? "$0.00",
    netAmount: data.netAmount ?? "$0.00",
  };
}

function buildPortalLink(clientId: string, taxYear: string): string {
  // In production, this would use a URL shortener service
  return `${PORTAL_BASE_URL}/status/${encodeURIComponent(taxYear)}`;
}
