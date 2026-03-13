/**
 * TCPA / CAN-SPAM compliance checking utilities
 *
 * These helpers are called before any outbound SMS or email notification is
 * dispatched.  A failed compliance check results in the notification being
 * suppressed (status = "suppressed" in the queue) with a logged reason.
 *
 * References:
 *   TCPA: 47 U.S.C. § 227
 *   CAN-SPAM Act: 15 U.S.C. §§ 7701-7713
 */

/** Result of a compliance check. */
export interface ComplianceCheckResult {
  /** True = message may be sent; false = message must be suppressed. */
  compliant: boolean;
  /** Human-readable reason for suppression (populated when compliant = false). */
  reason?: string;
}

/** Input for TCPA compliance checks. */
export interface TcpaCheckInput {
  /** Whether the client has an active (non-revoked) TCPA consent record. */
  hasActiveConsent: boolean;
  /** Whether SMS notifications are enabled in the client's preferences. */
  smsEnabled: boolean;
  /** Current UTC hour (0–23). */
  currentUtcHour: number;
  /** Client's preferred contact start hour (0–23, UTC). */
  contactHoursStart: number;
  /** Client's preferred contact end hour (0–23, UTC). */
  contactHoursEnd: number;
  /** Whether the phone number has been flagged as a landline. */
  isLandline?: boolean;
  /**
   * Number of SMS messages already sent to this client in the current
   * 24-hour rolling window.
   */
  smsSentLast24Hours: number;
  /** Maximum SMS messages allowed per 24-hour window (from config). */
  smsRateLimitPerDay: number;
}

/** Input for CAN-SPAM compliance checks. */
export interface CanSpamCheckInput {
  /** Whether the client has NOT globally unsubscribed from email. */
  hasActiveEmailConsent: boolean;
  /** Whether email notifications are enabled in the client's preferences. */
  emailEnabled: boolean;
  /** Whether the client's email address has hard-bounced. */
  isHardBounced: boolean;
  /** Whether the client has filed a spam complaint. */
  hasSpamComplaint: boolean;
  /**
   * Number of email messages already sent to this client in the current
   * 24-hour rolling window.
   */
  emailSentLast24Hours: number;
  /** Maximum email messages allowed per 24-hour window (from config). */
  emailRateLimitPerDay: number;
}

/**
 * Checks whether an SMS notification is TCPA-compliant and may be sent.
 *
 * Checks performed:
 * 1. Client has given express written consent (not revoked).
 * 2. SMS notifications are enabled in the client's preferences.
 * 3. Current time falls within the client's preferred contact window.
 * 4. Phone is not a known landline (auto-dialer restriction).
 * 5. Daily SMS rate limit has not been exceeded.
 *
 * @param input - Current state of the client and system at send time.
 * @returns ComplianceCheckResult indicating whether the SMS may be sent.
 */
export function checkTcpaCompliance(input: TcpaCheckInput): ComplianceCheckResult {
  if (!input.smsEnabled) {
    return { compliant: false, reason: "Client has SMS notifications disabled." };
  }

  if (!input.hasActiveConsent) {
    return {
      compliant: false,
      reason: "No active TCPA consent found. Client has not opted in or has revoked consent.",
    };
  }

  if (!isWithinContactWindow(input.currentUtcHour, input.contactHoursStart, input.contactHoursEnd)) {
    return {
      compliant: false,
      reason: `Current UTC hour (${input.currentUtcHour}) is outside the client's preferred contact window (${input.contactHoursStart}:00–${input.contactHoursEnd}:00 UTC).`,
    };
  }

  if (input.isLandline === true) {
    return {
      compliant: false,
      reason: "Phone number is identified as a landline; SMS cannot be delivered.",
    };
  }

  if (input.smsSentLast24Hours >= input.smsRateLimitPerDay) {
    return {
      compliant: false,
      reason: `Daily SMS rate limit of ${input.smsRateLimitPerDay} messages reached (${input.smsSentLast24Hours} sent in last 24 h).`,
    };
  }

  return { compliant: true };
}

/**
 * Checks whether an email notification is CAN-SPAM compliant and may be sent.
 *
 * Checks performed:
 * 1. Email notifications are enabled in the client's preferences.
 * 2. Client has not globally unsubscribed.
 * 3. Client's email address has not hard-bounced.
 * 4. Client has not filed a spam complaint.
 * 5. Daily email rate limit has not been exceeded.
 *
 * @param input - Current state of the client and email system at send time.
 * @returns ComplianceCheckResult indicating whether the email may be sent.
 */
export function checkCanSpamCompliance(input: CanSpamCheckInput): ComplianceCheckResult {
  if (!input.emailEnabled) {
    return { compliant: false, reason: "Client has email notifications disabled." };
  }

  if (!input.hasActiveEmailConsent) {
    return {
      compliant: false,
      reason: "Client has unsubscribed from email notifications.",
    };
  }

  if (input.isHardBounced) {
    return {
      compliant: false,
      reason: "Client email address has previously hard-bounced; suppressing to protect sender reputation.",
    };
  }

  if (input.hasSpamComplaint) {
    return {
      compliant: false,
      reason: "Client has filed a spam complaint; email suppressed per CAN-SPAM compliance.",
    };
  }

  if (input.emailSentLast24Hours >= input.emailRateLimitPerDay) {
    return {
      compliant: false,
      reason: `Daily email rate limit of ${input.emailRateLimitPerDay} messages reached (${input.emailSentLast24Hours} sent in last 24 h).`,
    };
  }

  return { compliant: true };
}

/**
 * Determines whether the given UTC hour falls within the contact window.
 *
 * Handles windows that span midnight (e.g., start=22, end=6).
 *
 * @param currentHour - Current UTC hour (0–23).
 * @param start - Window start hour (inclusive, 0–23).
 * @param end - Window end hour (exclusive, 0–23).
 * @returns True when the current hour is within the contact window.
 */
export function isWithinContactWindow(
  currentHour: number,
  start: number,
  end: number,
): boolean {
  if (start === end) return true; // All-day window
  if (start < end) {
    return currentHour >= start && currentHour < end;
  }
  // Spans midnight
  return currentHour >= start || currentHour < end;
}

/**
 * Validates that a contact hour window is sane (hours in 0–23 range).
 *
 * @param start - Window start hour (0–23).
 * @param end - Window end hour (0–23).
 * @returns True when both values are valid hour integers.
 */
export function isValidContactWindow(start: number, end: number): boolean {
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    start <= 23 &&
    end >= 0 &&
    end <= 23
  );
}

/**
 * Returns the number of hours until the contact window next opens.
 * Returns 0 when the window is currently open.
 * Accounts for day wraparound (e.g. window opens tomorrow morning).
 *
 * Examples:
 *   start=8, currentHour=6  → 2   (opens in 2 hours today)
 *   start=8, currentHour=8  → 0   (open right now)
 *   start=8, currentHour=22 → 10  (opens in 10 hours, i.e. tomorrow at 8)
 *
 * @param start - Window start hour (0–23).
 * @param currentHour - Current UTC hour (0–23).
 * @returns Hours until the window next opens (0 = open now or just opened).
 */
export function hoursUntilWindowOpens(start: number, currentHour: number): number {
  if (currentHour < start) {
    // Window hasn't opened yet today
    return start - currentHour;
  }
  if (currentHour === start) {
    return 0;
  }
  // currentHour > start: window opened earlier today; next opening is tomorrow
  return 24 - currentHour + start;
}
