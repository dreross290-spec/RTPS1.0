/**
 * Email template rendering
 *
 * Builds the dynamic template data objects required by SendGrid's Dynamic
 * Template engine and assembles the full SendGrid mail payload for each
 * RefundEventType.
 *
 * All HTML rendering is handled server-side by SendGrid's Handlebars engine
 * using the templates configured in EMAIL_TEMPLATES.  This module is
 * responsible for constructing the correct `dynamicTemplateData` payload
 * that SendGrid injects into the template.
 */

import type { RefundEventType } from "../constants/refund-events.js";
import {
  EMAIL_TEMPLATES,
  EMAIL_GLOBAL_SETTINGS,
  type EmailTemplateConfig,
} from "../constants/email-templates.js";
import { renderTemplateString } from "./renderer.js";

/** Common variables available in every email template. */
export interface EmailBaseVars {
  firstName: string;
  taxYear: string;
  /** Current year for footer copyright line. */
  currentYear: string;
  /** URL to the client's portal account. */
  portalUrl: string;
  /** URL to the unsubscribe / preferences management page. */
  unsubscribeUrl: string;
  /** Sender display name. */
  fromName: string;
}

/** Extended variables for events that include refund financial data. */
export interface EmailRefundAmountVars extends EmailBaseVars {
  refundAmount: string;
  expectedDate: string | undefined;
}

/** Variables for rejection notifications. */
export interface EmailRejectedVars extends EmailBaseVars {
  reason: string;
  supportUrl: string;
}

/** Variables for additional info requests. */
export interface EmailAdditionalInfoVars extends EmailBaseVars {
  infoNeeded: string;
  deadline: string;
  supportUrl: string;
}

/** Variables for offset notifications. */
export interface EmailOffsetVars extends EmailBaseVars {
  refundAmount: string;
  offsetAmount: string;
  netAmount: string;
  offsetReason: string | undefined;
  supportUrl: string;
}

/** Union of all email dynamic template data shapes. */
export type EmailTemplateVars =
  | EmailBaseVars
  | EmailRefundAmountVars
  | EmailRejectedVars
  | EmailAdditionalInfoVars
  | EmailOffsetVars;

/** Input required to render a complete email notification. */
export interface EmailRenderInput {
  eventType: RefundEventType;
  recipientEmail: string;
  firstName: string;
  taxYear: string;
  refundAmount?: string;
  expectedDate?: string;
  reason?: string;
  infoNeeded?: string;
  deadline?: string;
  offsetAmount?: string;
  netAmount?: string;
  offsetReason?: string;
  /** Base URL for the client portal (e.g. "https://app.example.com"). */
  portalBaseUrl?: string;
}

/** Fully constructed SendGrid mail data object ready for dispatch. */
export interface RenderedEmail {
  to: string;
  from: { name: string; email: string };
  replyTo: string;
  templateId: string;
  dynamicTemplateData: EmailTemplateVars;
  /** Resolved subject line (variables substituted). */
  subject: string;
  categories: string[];
  trackingSettings: {
    clickTracking: { enable: boolean };
    openTracking: { enable: boolean };
  };
}

/**
 * Renders a complete SendGrid email payload for a given refund event.
 *
 * @param input - Event type and personalization variables.
 * @returns RenderedEmail object ready to pass to the SendGrid client.
 * @throws {Error} When a required variable for the event type is missing.
 */
export function renderEmail(input: EmailRenderInput): RenderedEmail {
  const config: EmailTemplateConfig = EMAIL_TEMPLATES[input.eventType];

  const portalUrl = input.portalBaseUrl
    ? `${input.portalBaseUrl}/dashboard`
    : (process.env["APP_URL"] ?? "https://app.example.com") + "/dashboard";

  const unsubscribeUrl = input.portalBaseUrl
    ? `${input.portalBaseUrl}/notifications/unsubscribe`
    : (process.env["APP_URL"] ?? "https://app.example.com") + "/notifications/unsubscribe";

  const supportUrl = input.portalBaseUrl
    ? `${input.portalBaseUrl}/support`
    : (process.env["APP_URL"] ?? "https://app.example.com") + "/support";

  const baseVars: EmailBaseVars = {
    firstName: input.firstName || "Taxpayer",
    taxYear: input.taxYear,
    currentYear: new Date().getFullYear().toString(),
    portalUrl,
    unsubscribeUrl,
    fromName: EMAIL_GLOBAL_SETTINGS.fromName,
  };

  let dynamicTemplateData: EmailTemplateVars;

  switch (input.eventType) {
    case "RETURN_RECEIVED":
    case "RETURN_PROCESSING":
    case "UNDER_REVIEW":
    case "AMENDED_RETURN_PROCESSING":
    case "CANCELLED":
      dynamicTemplateData = { ...baseVars };
      break;

    case "REFUND_APPROVED":
    case "REFUND_SENT":
      assertVar(input.refundAmount, "refundAmount", input.eventType);
      dynamicTemplateData = {
        ...baseVars,
        refundAmount: input.refundAmount,
        expectedDate: input.expectedDate,
      } satisfies EmailRefundAmountVars;
      break;

    case "REFUND_DEPOSITED":
      assertVar(input.refundAmount, "refundAmount", input.eventType);
      dynamicTemplateData = {
        ...baseVars,
        refundAmount: input.refundAmount,
        expectedDate: undefined,
      } satisfies EmailRefundAmountVars;
      break;

    case "REFUND_REJECTED":
      assertVar(input.reason, "reason", input.eventType);
      dynamicTemplateData = {
        ...baseVars,
        reason: input.reason,
        supportUrl,
      } satisfies EmailRejectedVars;
      break;

    case "ADDITIONAL_INFO_REQUIRED":
      assertVar(input.infoNeeded, "infoNeeded", input.eventType);
      assertVar(input.deadline, "deadline", input.eventType);
      dynamicTemplateData = {
        ...baseVars,
        infoNeeded: input.infoNeeded,
        deadline: input.deadline,
        supportUrl,
      } satisfies EmailAdditionalInfoVars;
      break;

    case "OFFSET_APPLIED":
      assertVar(input.refundAmount, "refundAmount", input.eventType);
      assertVar(input.offsetAmount, "offsetAmount", input.eventType);
      assertVar(input.netAmount, "netAmount", input.eventType);
      dynamicTemplateData = {
        ...baseVars,
        refundAmount: input.refundAmount,
        offsetAmount: input.offsetAmount,
        netAmount: input.netAmount,
        offsetReason: input.offsetReason,
        supportUrl,
      } satisfies EmailOffsetVars;
      break;

    default: {
      const _exhaustive: never = input.eventType;
      throw new Error(`Unknown RefundEventType: ${String(_exhaustive)}`);
    }
  }

  const subject = renderTemplateString(
    config.defaultSubject,
    dynamicTemplateData as unknown as Record<string, string>,
  );

  return {
    to: input.recipientEmail,
    from: {
      name: EMAIL_GLOBAL_SETTINGS.fromName,
      email: EMAIL_GLOBAL_SETTINGS.fromEmail,
    },
    replyTo: EMAIL_GLOBAL_SETTINGS.replyTo,
    templateId: config.templateId,
    dynamicTemplateData,
    subject,
    categories: config.categories,
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
    },
  };
}

/** Asserts that a required template variable is present. */
function assertVar(
  value: string | undefined,
  varName: string,
  eventType: string,
): asserts value is string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Email template for event "${eventType}" requires "${varName}" but it was not provided or was empty.`,
    );
  }
}
