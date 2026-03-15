import { db } from "@server/lib/db";
import { taxReturns, transmittalHistory } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { submitToIRS } from "@server/_core/tax-operations/transmittal/irs-efile";

/**
 * Process all returns queued for transmittal to the IRS.
 */
export async function processTransmittalQueue(): Promise<void> {
  const queued = await db
    .select()
    .from(taxReturns)
    .where(eq(taxReturns.status, "review_approved"));

  console.log(`[TransmittalWorker] Processing ${queued.length} returns...`);

  for (const ret of queued) {
    try {
      const draftData = (ret.draftData ?? {}) as Record<string, unknown>;
      const payload = {
        ...draftData,
        returnId: ret.returnId,
        taxYear: ret.taxYear,
        returnType: ret.returnType,
        ssn: (draftData.personalInfo as Record<string, unknown>)?.ssn,
      };

      const result = await submitToIRS(payload);

      if (result.success) {
        await db
          .update(taxReturns)
          .set({
            status: "transmitted",
            transmittalStatus: "submitted",
            ackNumber: result.ackNumber,
            updatedAt: new Date(),
          })
          .where(eq(taxReturns.returnId, ret.returnId));

        console.log(`[TransmittalWorker] Return ${ret.returnId} submitted — ACK: ${result.ackNumber}`);
      } else {
        await db
          .update(taxReturns)
          .set({
            status: "transmittal_failed",
            updatedAt: new Date(),
          })
          .where(eq(taxReturns.returnId, ret.returnId));

        console.error(`[TransmittalWorker] Return ${ret.returnId} failed: ${result.errors?.join(", ")}`);
      }
    } catch (err) {
      console.error(
        `[TransmittalWorker] Error processing return ${ret.returnId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

/**
 * Retry transmittals that previously failed.
 */
export async function retryFailedTransmittals(): Promise<void> {
  const failed = await db
    .select()
    .from(taxReturns)
    .where(eq(taxReturns.status, "transmittal_failed"));

  console.log(`[TransmittalWorker] Retrying ${failed.length} failed transmittals...`);

  for (const ret of failed) {
    // Check how many attempts have been made
    const history = await db
      .select()
      .from(transmittalHistory)
      .where(eq(transmittalHistory.returnId, ret.returnId));

    // Max 3 retries
    if (history.length >= 3) {
      console.warn(`[TransmittalWorker] Return ${ret.returnId} exceeded max retries — skipping.`);
      continue;
    }

    // Queue for retry by resetting status
    await db
      .update(taxReturns)
      .set({ status: "review_approved", updatedAt: new Date() })
      .where(eq(taxReturns.returnId, ret.returnId));
  }
}
