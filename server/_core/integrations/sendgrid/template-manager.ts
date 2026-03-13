/**
 * SendGrid Template Manager
 *
 * Provides access to the configured email template catalog with versioning
 * support.  Templates are statically defined from the email-templates
 * constants and enriched with version metadata.
 */

import { EMAIL_TEMPLATES } from "../../../lib/constants/email-templates.js";
import { ALL_REFUND_EVENT_TYPES, type RefundEventType } from "../../../lib/constants/refund-events.js";
import type { EmailTemplate } from "../../notifications/types.js";

// ─── Template Version ─────────────────────────────────────────────────────────

/** Current template catalog version.  Increment when templates are updated. */
const TEMPLATE_CATALOG_VERSION = "1.0.0";
const TEMPLATE_UPDATED_AT = "2024-01-01";

// ─── Manager ──────────────────────────────────────────────────────────────────

/**
 * Retrieves the email template configuration for a given event type.
 * Throws if the event type has no configured template.
 */
export function getTemplate(eventType: RefundEventType): EmailTemplate {
  const config = EMAIL_TEMPLATES[eventType];

  return {
    eventType,
    templateId: config.templateId,
    defaultSubject: config.defaultSubject,
    categories: [...config.categories],
    version: TEMPLATE_CATALOG_VERSION,
    updatedAt: TEMPLATE_UPDATED_AT,
  };
}

/**
 * Returns all configured email templates.
 */
export function listTemplates(): EmailTemplate[] {
  return ALL_REFUND_EVENT_TYPES.map((eventType) => getTemplate(eventType));
}

/**
 * Checks whether a template ID is valid/known.
 */
export function isValidTemplateId(templateId: string): boolean {
  return ALL_REFUND_EVENT_TYPES.some(
    (et) => EMAIL_TEMPLATES[et].templateId === templateId,
  );
}

/**
 * Returns the event type for a given SendGrid template ID,
 * or null if not found.
 */
export function getEventTypeForTemplateId(templateId: string): RefundEventType | null {
  for (const eventType of ALL_REFUND_EVENT_TYPES) {
    if (EMAIL_TEMPLATES[eventType].templateId === templateId) {
      return eventType;
    }
  }
  return null;
}

/** Template catalog metadata. */
export interface TemplateCatalogInfo {
  version: string;
  templateCount: number;
  updatedAt: string;
}

/**
 * Returns metadata about the current template catalog.
 */
export function getCatalogInfo(): TemplateCatalogInfo {
  return {
    version: TEMPLATE_CATALOG_VERSION,
    templateCount: ALL_REFUND_EVENT_TYPES.length,
    updatedAt: TEMPLATE_UPDATED_AT,
  };
}
