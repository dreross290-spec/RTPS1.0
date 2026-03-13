/**
 * Refund Status Parser
 *
 * Compares a previous and current RefundStatus to detect all status transitions,
 * extract amounts and dates, flag anomalies, and produce a list of
 * RefundStatusEvents ready for notification routing.
 */

import { v4 as uuidv4 } from "uuid";
import { RefundEventType, MANDATORY_NOTIFICATION_EVENTS } from "../../lib/constants/refund-events.js";
import type { RefundStatus } from "../../../drizzle/schema/refund-status.js";
import type {
  RefundStatusUpdate,
  RefundStatusEvent,
  RefundEventData,
  StatusAnomaly,
} from "../notifications/types.js";

// ─── Status → EventType Map ───────────────────────────────────────────────────

const STATUS_TO_EVENT_TYPE: ReadonlyMap<RefundStatus, RefundEventType> = new Map([
  ["return_received", RefundEventType.RETURN_RECEIVED],
  ["return_processing", RefundEventType.RETURN_PROCESSING],
  ["refund_approved", RefundEventType.REFUND_APPROVED],
  ["refund_sent", RefundEventType.REFUND_SENT],
  ["refund_deposited", RefundEventType.REFUND_DEPOSITED],
  ["refund_rejected", RefundEventType.REFUND_REJECTED],
  ["additional_info_required", RefundEventType.ADDITIONAL_INFO_REQUIRED],
  ["under_review", RefundEventType.UNDER_REVIEW],
  ["offset_applied", RefundEventType.OFFSET_APPLIED],
  ["amended_return_processing", RefundEventType.AMENDED_RETURN_PROCESSING],
  ["cancelled", RefundEventType.CANCELLED],
]);

/** How many days without progress constitutes a "delay" anomaly. */
const DELAY_THRESHOLD_DAYS = 21;

/** Amount change threshold (in dollars) for anomaly flagging. */
const AMOUNT_CHANGE_THRESHOLD_DOLLARS = 100;

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parses a refund status change and returns a list of events to fire.
 *
 * @param previous - The last known status (null for first-ever status).
 * @param current  - The new RefundStatusUpdate from the IRS.
 * @param firstName - Client first name for template personalization.
 * @param previousAmount - Previous refund amount (for anomaly detection).
 * @param previousStatusDate - When the previous status was recorded.
 */
export function parseRefundStatusChange(
  previous: RefundStatus | null,
  current: RefundStatusUpdate,
  firstName = "Taxpayer",
  previousAmount: string | null = null,
  previousStatusDate: Date | null = null,
): RefundStatusEvent[] {
  // No change → no events
  if (previous === current.newStatus) {
    return [];
  }

  const anomalies = detectAnomalies(current, previous, previousAmount, previousStatusDate);

  const events: RefundStatusEvent[] = [];
  const eventType = STATUS_TO_EVENT_TYPE.get(current.newStatus);

  if (eventType !== undefined) {
    const eventData = buildEventData(eventType, current, firstName);

    events.push({
      id: uuidv4(),
      clientId: current.clientId,
      taxYear: current.taxYear,
      eventType,
      refundStatusUpdate: {
        ...current,
        previousStatus: previous,
      },
      eventData,
      isMandatory: MANDATORY_NOTIFICATION_EVENTS.has(eventType),
      detectedAt: new Date(),
    });
  }

  // Additional anomaly-triggered events (logged separately)
  for (const anomaly of anomalies) {
    if (anomaly.severity === "high") {
      logAnomaly(current.clientId, anomaly);
    }
  }

  return events;
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

function detectAnomalies(
  current: RefundStatusUpdate,
  previous: RefundStatus | null,
  previousAmount: string | null,
  previousStatusDate: Date | null,
): StatusAnomaly[] {
  const anomalies: StatusAnomaly[] = [];

  // 1. Amount change > $100
  if (current.refundAmount !== null && previousAmount !== null) {
    const curr = parseDollarAmount(current.refundAmount);
    const prev = parseDollarAmount(previousAmount);
    const delta = Math.abs(curr - prev);
    if (delta > AMOUNT_CHANGE_THRESHOLD_DOLLARS) {
      anomalies.push({
        type: "amount_change",
        description: `Refund amount changed by $${delta.toFixed(2)} (${previousAmount} → ${current.refundAmount})`,
        severity: delta > 500 ? "high" : "medium",
      });
    }
  }

  // 2. Status reversal (e.g., refund_approved → return_processing)
  if (previous !== null && isStatusReversal(previous, current.newStatus)) {
    anomalies.push({
      type: "reversal",
      description: `Status reversed from ${previous} to ${current.newStatus}`,
      severity: "high",
    });
  }

  // 3. Delay > 21 days without reaching refund_sent/deposited
  if (
    previousStatusDate !== null &&
    previous !== null &&
    !["refund_sent", "refund_deposited", "refund_rejected", "cancelled"].includes(previous)
  ) {
    const daysSinceLastChange = (Date.now() - previousStatusDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastChange > DELAY_THRESHOLD_DAYS) {
      anomalies.push({
        type: "delay",
        description: `Return has been in ${previous} status for ${Math.floor(daysSinceLastChange)} days (threshold: ${DELAY_THRESHOLD_DAYS})`,
        severity: "medium",
      });
    }
  }

  return anomalies;
}

/** Returns true if transitioning from `from` to `to` is a backward step. */
const STATUS_ORDER: ReadonlyMap<RefundStatus, number> = new Map([
  ["return_received", 1],
  ["return_processing", 2],
  ["refund_approved", 3],
  ["refund_sent", 4],
  ["refund_deposited", 5],
]);

function isStatusReversal(from: RefundStatus, to: RefundStatus): boolean {
  const fromOrder = STATUS_ORDER.get(from);
  const toOrder = STATUS_ORDER.get(to);
  if (fromOrder === undefined || toOrder === undefined) return false;
  return toOrder < fromOrder;
}

// ─── Event Data Builder ───────────────────────────────────────────────────────

function buildEventData(
  eventType: RefundEventType,
  update: RefundStatusUpdate,
  firstName: string,
): RefundEventData {
  const portalUrl = `${process.env["PORTAL_BASE_URL"] ?? "https://app.example.com"}/status/${update.taxYear}`;

  return {
    clientId: update.clientId,
    firstName,
    taxYear: update.taxYear,
    refundAmount: update.refundAmount,
    expectedDate: update.expectedDepositDate !== null
      ? formatDisplayDate(update.expectedDepositDate)
      : null,
    reason: update.statusMessage,
    infoNeeded: eventType === RefundEventType.ADDITIONAL_INFO_REQUIRED
      ? (update.statusMessage ?? "additional documentation")
      : null,
    deadline: null,
    offsetAmount: null,
    netAmount: null,
    paymentMethod: update.paymentMethod,
    portalUrl,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDollarAmount(formatted: string): number {
  return parseFloat(formatted.replace(/[$,]/g, "")) || 0;
}

function formatDisplayDate(isoDate: string): string {
  // Validate YYYY-MM-DD format before parsing
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate; // Return as-is for non-standard formats
  }
  // Append noon UTC to avoid timezone boundary shifts when converting to locale date
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function logAnomaly(clientId: string, anomaly: StatusAnomaly): void {
  console.warn(JSON.stringify({
    level: "warn",
    service: "RefundStatusParser",
    message: "Status anomaly detected",
    clientId,
    anomalyType: anomaly.type,
    severity: anomaly.severity,
    description: anomaly.description,
    ts: new Date().toISOString(),
  }));
}
