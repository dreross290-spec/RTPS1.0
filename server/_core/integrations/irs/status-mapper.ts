/**
 * IRS Transcript → App Status Mapper
 *
 * Maps IRS CADE-2 transaction codes to the application's RefundStatus enum
 * and derives additional metadata (payment method, expected delivery dates).
 *
 * Key IRS Transaction Codes:
 *   150  – Return filed / tax return submitted
 *   290  – Additional tax assessed (zero dollars = informational)
 *   420  – Examination indicator (return under review)
 *   570  – Additional account action pending (hold on refund)
 *   571  – Hold released
 *   806  – W-2 or 1099 withholding credit
 *   810  – Refund freeze
 *   811  – Frozen refund released
 *   846  – Refund issued (direct deposit or check)
 *   898  – Refund applied to non-IRS debt (offset)
 *   971  – Notice issued (requires action)
 *  1058  – Tax return processed (amended)
 */

import type {
  IRSTranscript,
  IRSTranscriptEntry,
  RefundStatusUpdate,
} from "../../notifications/types.js";
import type { RefundStatus } from "../../../../drizzle/schema/refund-status.js";

// ─── Code Mappings ────────────────────────────────────────────────────────────

/** IRS transaction codes that directly map to a RefundStatus. */
const CODE_TO_STATUS: ReadonlyMap<number, RefundStatus> = new Map([
  [150, "return_received"],
  [806, "return_processing"],
  [420, "under_review"],
  [810, "under_review"],      // Refund freeze
  [570, "under_review"],      // Additional action pending
  [811, "return_processing"], // Freeze released
  [571, "return_processing"], // Hold released
  [846, "refund_sent"],
  [898, "offset_applied"],
  [971, "additional_info_required"],
  [1058, "amended_return_processing"],
]);

/** Transaction codes that indicate a refund has been approved but not yet sent. */
const REFUND_APPROVED_CODES = new Set([768, 766, 806]);

/** Code 846 payment type indicator in the description. */
const DIRECT_DEPOSIT_INDICATORS = ["direct deposit", "dd", "ach"];
const CHECK_INDICATORS = ["paper check", "check", "mail"];

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Maps an IRS account transcript to a RefundStatusUpdate.
 *
 * The "most recent" meaningful transaction code determines the current status.
 * The entries are processed in chronological order; later codes override earlier ones.
 */
export function mapTranscriptToRefundStatus(transcript: IRSTranscript): RefundStatusUpdate {
  const sortedEntries = [...transcript.entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  let currentStatus: RefundStatus = "return_received";
  let refundAmountCents = 0;
  let expectedDepositDate: string | null = null;
  let paymentMethod: "direct_deposit" | "check" | null = null;
  let trackingNumber: string | null = null;
  let statusMessage: string | null = null;

  for (const entry of sortedEntries) {
    const mapped = CODE_TO_STATUS.get(entry.code);
    if (mapped !== undefined) {
      currentStatus = mapped;
    }

    // Code 846: Refund issued – extract amount, payment method, expected date
    if (entry.code === 846) {
      if (entry.amount !== undefined && entry.amount !== 0) {
        refundAmountCents = Math.abs(entry.amount);
      }
      paymentMethod = detectPaymentMethod(entry);
      expectedDepositDate = calculateExpectedDeliveryDate(entry, paymentMethod);
      trackingNumber = extractTrackingNumber(entry);
      currentStatus = "refund_sent";
    }

    // Code 898: Offset applied
    if (entry.code === 898) {
      currentStatus = "offset_applied";
      statusMessage = entry.description ?? "A debt offset was applied to your refund.";
    }

    // Code 971: Notice issued
    if (entry.code === 971) {
      currentStatus = "additional_info_required";
      statusMessage = entry.description ?? "The IRS has issued a notice for your return.";
    }

    // Code 420: Under review (examination)
    if (entry.code === 420) {
      currentStatus = "under_review";
      statusMessage = "Your return has been selected for examination.";
    }

    // Check for refund approved (credit codes present, 846 not yet seen)
    if (REFUND_APPROVED_CODES.has(entry.code) && currentStatus === "return_processing") {
      currentStatus = "refund_approved";
    }
  }

  // Determine if a refund has been confirmed as deposited
  // (This would typically come from a code 846 + bank confirmation, but we
  //  approximate with a date-based check)
  if (currentStatus === "refund_sent" && expectedDepositDate !== null) {
    const depositDate = new Date(expectedDepositDate);
    if (depositDate < new Date()) {
      currentStatus = "refund_deposited";
    }
  }

  const formattedAmount =
    refundAmountCents > 0
      ? formatCentsAsDollars(refundAmountCents)
      : null;

  return {
    clientId: "",  // Intentionally empty — callers MUST set this from their return registry before persisting
    taxYear: String(transcript.taxYear),
    trackingNumber,
    previousStatus: null, // Caller fills this in from DB
    newStatus: currentStatus,
    refundAmount: formattedAmount,
    expectedDepositDate,
    statusMessage,
    paymentMethod,
    refundStatusHistoryId: "", // Caller fills this in after DB insert
    recordedAt: new Date(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPaymentMethod(entry: IRSTranscriptEntry): "direct_deposit" | "check" | null {
  const desc = (entry.description ?? "").toLowerCase();

  for (const indicator of DIRECT_DEPOSIT_INDICATORS) {
    if (desc.includes(indicator)) return "direct_deposit";
  }
  for (const indicator of CHECK_INDICATORS) {
    if (desc.includes(indicator)) return "check";
  }

  // Fall back to metadata if available
  const meta = entry.metadata ?? {};
  const methodFromMeta = meta["payment_method"];
  if (methodFromMeta === "direct_deposit" || methodFromMeta === "dd") {
    return "direct_deposit";
  }
  if (methodFromMeta === "check" || methodFromMeta === "paper_check") {
    return "check";
  }

  return null;
}

/**
 * Calculates the expected delivery date based on payment method.
 * IRS standard: direct deposit 1-5 business days from issue; check 5-21 days.
 */
function calculateExpectedDeliveryDate(
  entry: IRSTranscriptEntry,
  paymentMethod: "direct_deposit" | "check" | null,
): string {
  // If the IRS provided an explicit expected date, use it
  const meta = entry.metadata ?? {};
  if (typeof meta["expected_deposit_date"] === "string" && meta["expected_deposit_date"]) {
    return meta["expected_deposit_date"] as string;
  }

  const issueDate = new Date(entry.date);
  const deliveryDays = paymentMethod === "check" ? 21 : 5;
  const deliveryDate = addBusinessDays(issueDate, deliveryDays);
  return deliveryDate.toISOString().split("T")[0] as string;
}

function extractTrackingNumber(entry: IRSTranscriptEntry): string | null {
  const meta = entry.metadata ?? {};
  if (typeof meta["tracking_number"] === "string" && meta["tracking_number"]) {
    return meta["tracking_number"] as string;
  }
  if (typeof meta["confirmation_number"] === "string" && meta["confirmation_number"]) {
    return meta["confirmation_number"] as string;
  }
  return null;
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
      added++;
    }
  }
  return result;
}

function formatCentsAsDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
