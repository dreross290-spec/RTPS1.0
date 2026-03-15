/**
 * Email Renderer
 *
 * Generates HTML email content and resolves dynamic template data for
 * SendGrid Dynamic Templates.  Injects CAN-SPAM required unsubscribe links
 * and performs dynamic variable substitution.
 */

import type { RefundEventType } from "../../../lib/constants/refund-events.js";
import { EMAIL_TEMPLATES, EMAIL_GLOBAL_SETTINGS } from "../../../lib/constants/email-templates.js";
import type { RefundEventData, EmailContent } from "../../notifications/types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const PORTAL_BASE_URL = process.env["PORTAL_BASE_URL"] ?? "https://app.example.com";
const UNSUBSCRIBE_BASE_URL = process.env["UNSUBSCRIBE_BASE_URL"] ?? `${PORTAL_BASE_URL}/unsubscribe`;

// ─── Renderer ────────────────────────────────────────────────────────────────

/**
 * Renders full email content for a given event type and event data.
 * Returns the template ID, resolved subject, and dynamic template variables
 * for SendGrid to render server-side.
 */
export function renderEmailTemplate(
  eventType: RefundEventType,
  data: RefundEventData,
  unsubscribeToken: string,
): EmailContent {
  const templateConfig = EMAIL_TEMPLATES[eventType];
  const dynamicData = buildDynamicData(eventType, data, unsubscribeToken);

  // Resolve subject line (substitute {{variables}})
  const subject = resolveSubject(templateConfig.defaultSubject, dynamicData);

  const unsubscribeUrl = buildUnsubscribeUrl(data.clientId, unsubscribeToken);

  return {
    templateId: templateConfig.templateId,
    subject,
    dynamicTemplateData: dynamicData,
    categories: [...templateConfig.categories],
    unsubscribeUrl,
    unsubscribeText: "Click here to unsubscribe from these notifications.",
  };
}

// ─── Dynamic Data Builder ────────────────────────────────────────────────────

/**
 * Constructs the dynamic template data object passed to SendGrid.
 * All values are safe for HTML rendering (no raw PII).
 */
function buildDynamicData(
  eventType: RefundEventType,
  data: RefundEventData,
  unsubscribeToken: string,
): Record<string, unknown> {
  const unsubscribeUrl = buildUnsubscribeUrl(data.clientId, unsubscribeToken);
  const portalUrl = buildPortalUrl(data.clientId, data.taxYear);

  const base: Record<string, unknown> = {
    firstName: escapeHtml(data.firstName || "Taxpayer"),
    taxYear: escapeHtml(data.taxYear),
    portalUrl,
    unsubscribeUrl,
    unsubscribeText: "Unsubscribe",
    fromName: EMAIL_GLOBAL_SETTINGS.fromName,
    currentYear: new Date().getFullYear().toString(),
    // CAN-SPAM physical address (required)
    physicalAddress: process.env["COMPANY_PHYSICAL_ADDRESS"] ?? "123 Main St, Suite 100, Anytown, USA 12345",
    companyName: process.env["COMPANY_NAME"] ?? "Tax Refund Updates",
  };

  // Add event-specific variables
  switch (eventType) {
    case "REFUND_APPROVED":
    case "REFUND_SENT":
      base["refundAmount"] = escapeHtml(data.refundAmount ?? "$0.00");
      base["expectedDate"] = escapeHtml(data.expectedDate ?? "TBD");
      base["paymentMethod"] = data.paymentMethod === "check" ? "paper check" : "direct deposit";
      break;

    case "REFUND_DEPOSITED":
      base["refundAmount"] = escapeHtml(data.refundAmount ?? "$0.00");
      base["paymentMethod"] = data.paymentMethod === "check" ? "paper check" : "direct deposit";
      break;

    case "REFUND_REJECTED":
      base["reason"] = escapeHtml(data.reason ?? "Please log in for details.");
      break;

    case "ADDITIONAL_INFO_REQUIRED":
      base["infoNeeded"] = escapeHtml(data.infoNeeded ?? "additional documentation");
      base["deadline"] = escapeHtml(data.deadline ?? "as soon as possible");
      break;

    case "OFFSET_APPLIED":
      base["refundAmount"] = escapeHtml(data.refundAmount ?? "$0.00");
      base["offsetAmount"] = escapeHtml(data.offsetAmount ?? "$0.00");
      base["netAmount"] = escapeHtml(data.netAmount ?? "$0.00");
      break;

    default:
      break;
  }

  return base;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveSubject(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key];
    return typeof value === "string" ? value : _match;
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildUnsubscribeUrl(clientId: string, token: string): string {
  return `${UNSUBSCRIBE_BASE_URL}?clientId=${encodeURIComponent(clientId)}&token=${encodeURIComponent(token)}`;
}

function buildPortalUrl(clientId: string, taxYear: string): string {
  return `${PORTAL_BASE_URL}/status/${encodeURIComponent(taxYear)}`;
}
