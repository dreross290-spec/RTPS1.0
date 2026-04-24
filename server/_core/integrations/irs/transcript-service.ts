import { db } from "@server/lib/db";
import { taxReturns, legacyRefundStatusHistory } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { decryptSSN } from "@server/lib/utils/encryption";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TranscriptResult {
  success: boolean;
  refundStatus?: string;
  refundAmount?: string;
  expectedDate?: string;
  rawData?: unknown;
  error?: string;
}

export interface CADE2Status {
  status: string;
  stage: string;
  refundDate?: string;
  refundAmount?: string;
  message: string;
}

// IRS refund status stage codes
const REFUND_STAGE_MAP: Record<string, string> = {
  "1": "return_received",
  "2": "return_approved",
  "3": "refund_sent",
  "4": "direct_deposit_sent",
  "5": "check_mailed",
  "9": "additional_info_required",
};

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Poll the IRS transcript service for a taxpayer's refund status.
 * In production, this calls the IRS IDRS/CADE-2 transcript API.
 */
export async function pollTranscript(
  ssnEncrypted: string,
  taxYear: number
): Promise<TranscriptResult> {
  try {
    // Decrypt SSN for API call — never log the decrypted value
    const ssn = decryptSSN(ssnEncrypted);

    // Production: POST to IRS e-Services Transcript Delivery System (TDS)
    // This stub returns a simulated response
    const simulatedTranscript = simulateTranscriptResponse(ssn, taxYear);

    const refundStatus = parseRefundStatus(simulatedTranscript);

    return {
      success: true,
      refundStatus: refundStatus.status,
      refundAmount: refundStatus.amount,
      expectedDate: refundStatus.expectedDate,
      rawData: simulatedTranscript,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Transcript poll failed",
    };
  }
}

/**
 * Parse refund status from a raw transcript response.
 */
export function parseRefundStatus(transcript: Record<string, unknown>): {
  status: string;
  amount?: string;
  expectedDate?: string;
} {
  const stageCode = String(transcript.cycleCode ?? transcript.stage ?? "1");
  const status = REFUND_STAGE_MAP[stageCode] ?? "return_received";

  return {
    status,
    amount: transcript.refundAmount ? String(transcript.refundAmount) : undefined,
    expectedDate: transcript.refundDate ? String(transcript.refundDate) : undefined,
  };
}

/**
 * Get CADE-2 (Customer Account Data Engine 2) status for a taxpayer.
 */
export async function getCADE2Status(
  ssnEncrypted: string,
  taxYear: number
): Promise<CADE2Status> {
  const result = await pollTranscript(ssnEncrypted, taxYear);

  if (!result.success) {
    return {
      status: "error",
      stage: "unknown",
      message: result.error ?? "Failed to retrieve CADE-2 status",
    };
  }

  return {
    status: result.refundStatus ?? "return_received",
    stage: result.refundStatus ?? "return_received",
    refundDate: result.expectedDate,
    refundAmount: result.refundAmount,
    message: getStatusMessage(result.refundStatus ?? "return_received"),
  };
}

/**
 * Detect whether the refund status has changed and persist the change.
 */
export async function detectStatusChange(
  returnId: string,
  currentStatus: string | null,
  newStatus: string,
  refundAmount?: string
): Promise<boolean> {
  if (currentStatus === newStatus) return false;

  await db.insert(legacyRefundStatusHistory).values({
    returnId,
    previousStatus: currentStatus,
    newStatus,
    refundAmount: refundAmount ?? null,
    source: "irs_transcript",
    notificationSent: false,
  });

  await db
    .update(taxReturns)
    .set({
      refundStatus: newStatus,
      refundAmount: refundAmount ?? undefined,
      lastRefundCheckAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(taxReturns.returnId, returnId));

  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    return_received: "Your return has been received and is being processed.",
    return_approved: "Your return has been approved.",
    refund_sent: "Your refund has been sent.",
    direct_deposit_sent: "Your refund has been deposited to your bank account.",
    check_mailed: "Your refund check has been mailed.",
    additional_info_required: "Additional information is required to process your return.",
  };
  return messages[status] ?? "Status unknown — please check back later.";
}

function simulateTranscriptResponse(
  _ssn: string,
  _taxYear: number
): Record<string, unknown> {
  // Stub — in production, call the IRS TDS API
  return {
    stage: "2",
    refundAmount: "1234.00",
    refundDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
