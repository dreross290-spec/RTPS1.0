import { db } from "@server/lib/db";
import { taxReturns, transmittalHistory } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { checkTransmittalStatus } from "./irs-efile";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransmittalStatusUpdate {
  returnId: string;
  status: string;
  ackNumber?: string;
  errorDetails?: Record<string, unknown>;
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Update the transmittal status of a return and record history.
 */
export async function updateTransmittalStatus(
  returnId: string,
  status: string,
  ackNumber?: string,
  errorDetails?: Record<string, unknown>
): Promise<void> {
  await db
    .update(taxReturns)
    .set({
      transmittalStatus: status,
      ackNumber: ackNumber ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(taxReturns.returnId, returnId));

  await db.insert(transmittalHistory).values({
    returnId,
    transmittalType: "irs_efile",
    status,
    ackDate: ackNumber ? new Date() : undefined,
    errorDetails: errorDetails ?? undefined,
  });
}

/**
 * Retrieve the full transmittal history for a return.
 */
export async function getTransmittalHistory(returnId: string) {
  return db.query.transmittalHistory.findMany({
    where: eq(transmittalHistory.returnId, returnId),
  });
}

/**
 * Poll all returns with a "submitted" or "pending" status and update them.
 */
export async function monitorPendingTransmittals(): Promise<void> {
  const pending = await db
    .select()
    .from(taxReturns)
    .where(
      and(
        // Only returns that have been submitted to the IRS
        eq(taxReturns.transmittalStatus, "submitted")
      )
    );

  for (const ret of pending) {
    if (!ret.ackNumber) continue;

    try {
      const statusResult = await checkTransmittalStatus(ret.ackNumber);
      if (statusResult.status !== ret.transmittalStatus) {
        await updateTransmittalStatus(ret.returnId, statusResult.status, ret.ackNumber);
      }
    } catch {
      // Non-fatal — log and continue
      console.error(`Failed to check status for return ${ret.returnId}`);
    }
  }
}
