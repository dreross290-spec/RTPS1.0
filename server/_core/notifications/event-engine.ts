/**
 * Event Engine
 *
 * Transforms RefundStatusEvents into NotificationEvents, applying:
 *   - Client preference filtering (event type opt-in/out)
 *   - TCPA consent check before SMS
 *   - CAN-SPAM/opt-out check before email
 *   - Contact hour window enforcement
 *   - Mandatory event bypass (always deliver certain events)
 */

import {
  MANDATORY_NOTIFICATION_EVENTS,
  type RefundEventType,
} from "../../lib/constants/refund-events.js";
import type {
  RefundStatusEvent,
  NotificationPreferences,
  NotificationEvent,
  NotificationQueueItem,
  SmsQueuePayload,
  EmailQueuePayload,
} from "./types.js";
import { formatSMS } from "../integrations/twilio/sms-formatter.js";
import { renderEmailTemplate } from "../integrations/sendgrid/email-renderer.js";
import { getTemplate } from "../integrations/sendgrid/template-manager.js";
import { isWithinContactHours, generateUnsubscribeToken } from "./compliance.js";
import { encrypt } from "../../lib/utils/encryption.js";
import { v4 as uuidv4 } from "uuid";

// ─── Engine ───────────────────────────────────────────────────────────────────

export interface ProcessedNotifications {
  /** Notifications ready to enqueue. */
  toQueue: NotificationQueueItem[];
  /** Notifications suppressed with reasons. */
  suppressed: Array<{ channel: "sms" | "email"; reason: string }>;
}

/**
 * Processes a single RefundStatusEvent and produces NotificationQueueItems
 * for each applicable channel based on client preferences.
 *
 * @param event           - The status event to process.
 * @param prefs           - The client's notification preferences.
 * @param hasTCPAConsent  - Whether the client has active TCPA consent.
 * @param hasEmailOptOut  - Whether the client has globally unsubscribed from email.
 * @param notificationEventId - UUID of the notification_events row (pre-created).
 */
export function processRefundEvent(
  event: RefundStatusEvent,
  prefs: NotificationPreferences,
  hasTCPAConsent: boolean,
  hasEmailOptOut: boolean,
  notificationEventId: string,
): ProcessedNotifications {
  const toQueue: NotificationQueueItem[] = [];
  const suppressed: Array<{ channel: "sms" | "email"; reason: string }> = [];

  const isMandatory = MANDATORY_NOTIFICATION_EVENTS.has(event.eventType);

  // ── SMS ──────────────────────────────────────────────────────────────────────
  if (prefs.smsEnabled && prefs.encryptedPhone !== null) {
    const smsCheck = checkSMSEligibility(event.eventType, prefs, hasTCPAConsent, isMandatory);

    if (smsCheck.eligible) {
      const formatted = formatSMS(event.eventType, event.eventData);

      const payload: SmsQueuePayload = {
        type: "sms",
        toEncrypted: prefs.encryptedPhone,
        body: formatted.body,
      };

      const scheduledFor = resolveScheduledTime(prefs, "sms");

      toQueue.push(buildQueueItem(
        notificationEventId,
        prefs.clientId,
        "sms",
        payload,
        scheduledFor,
      ));
    } else {
      suppressed.push({ channel: "sms", reason: smsCheck.reason ?? "Suppressed" });
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────────
  if (prefs.emailEnabled && prefs.encryptedEmail !== null) {
    const emailCheck = checkEmailEligibility(event.eventType, prefs, hasEmailOptOut, isMandatory);

    if (emailCheck.eligible) {
      const unsubscribeToken = generateUnsubscribeToken(prefs.clientId);
      const emailContent = renderEmailTemplate(
        event.eventType,
        event.eventData,
        unsubscribeToken,
      );
      const template = getTemplate(event.eventType);

      const payload: EmailQueuePayload = {
        type: "email",
        toEncrypted: prefs.encryptedEmail,
        templateId: emailContent.templateId,
        dynamicTemplateData: {
          ...emailContent.dynamicTemplateData,
          unsubscribeUrl: emailContent.unsubscribeUrl,
        },
        subject: emailContent.subject,
        categories: template.categories,
      };

      const scheduledFor = resolveScheduledTime(prefs, "email");

      toQueue.push(buildQueueItem(
        notificationEventId,
        prefs.clientId,
        "email",
        payload,
        scheduledFor,
      ));
    } else {
      suppressed.push({ channel: "email", reason: emailCheck.reason ?? "Suppressed" });
    }
  }

  return { toQueue, suppressed };
}

// ─── Eligibility Checks ───────────────────────────────────────────────────────

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

function checkSMSEligibility(
  eventType: RefundEventType,
  prefs: NotificationPreferences,
  hasTCPAConsent: boolean,
  isMandatory: boolean,
): EligibilityResult {
  // 1. TCPA consent required for SMS (even mandatory events need consent)
  if (!hasTCPAConsent) {
    return { eligible: false, reason: "No active TCPA consent for SMS." };
  }

  // 2. Check event type preference (unless mandatory)
  if (!isMandatory) {
    const eventPref = prefs.eventTypePreferences[eventType];
    if (eventPref === false) {
      return { eligible: false, reason: `Client opted out of ${eventType} SMS notifications.` };
    }
  }

  // 3. Contact hour check (allow mandatory even outside hours for now – log it)
  if (!isMandatory && !isWithinContactHours(prefs)) {
    return { eligible: false, reason: "Outside preferred contact hours." };
  }

  return { eligible: true };
}

function checkEmailEligibility(
  eventType: RefundEventType,
  prefs: NotificationPreferences,
  hasEmailOptOut: boolean,
  isMandatory: boolean,
): EligibilityResult {
  // 1. Global email opt-out
  if (hasEmailOptOut && !isMandatory) {
    return { eligible: false, reason: "Client has globally unsubscribed from email." };
  }

  // 2. Event type preference
  if (!isMandatory) {
    const eventPref = prefs.eventTypePreferences[eventType];
    if (eventPref === false) {
      return { eligible: false, reason: `Client opted out of ${eventType} email notifications.` };
    }
  }

  // 3. Contact hour window for non-mandatory emails
  if (!isMandatory && !isWithinContactHours(prefs)) {
    return { eligible: false, reason: "Outside preferred contact hours." };
  }

  return { eligible: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveScheduledTime(
  prefs: NotificationPreferences,
  channel: "sms" | "email",
): Date | null {
  if (prefs.notificationFrequency === "realtime") {
    return null; // Send immediately
  }

  if (prefs.notificationFrequency === "daily_digest") {
    // Schedule for the start of the next preferred contact window
    return nextContactWindowStart(prefs);
  }

  if (prefs.notificationFrequency === "weekly") {
    // Schedule for next Monday at contact window start
    return nextWeeklyDigestTime(prefs);
  }

  return null;
}

function nextContactWindowStart(prefs: NotificationPreferences): Date {
  const now = new Date();
  const startHour = prefs.preferredContactHoursStart;
  const candidate = new Date(now);
  candidate.setUTCHours(startHour, 0, 0, 0);

  if (candidate <= now) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return candidate;
}

function nextWeeklyDigestTime(prefs: NotificationPreferences): Date {
  const candidate = nextContactWindowStart(prefs);
  // Find next Monday (day 1)
  while (candidate.getUTCDay() !== 1) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  candidate.setUTCHours(prefs.preferredContactHoursStart, 0, 0, 0);
  return candidate;
}

function buildQueueItem(
  notificationEventId: string,
  clientId: string,
  channel: "sms" | "email",
  payload: SmsQueuePayload | EmailQueuePayload,
  scheduledFor: Date | null,
): NotificationQueueItem {
  return {
    id: uuidv4(),
    notificationEventId,
    clientId,
    channel,
    payload,
    status: scheduledFor !== null ? "scheduled" : "pending",
    attemptCount: 0,
    maxRetries: 3,
    scheduledFor,
    lastAttemptAt: null,
    lastError: null,
    createdAt: new Date(),
  };
}
