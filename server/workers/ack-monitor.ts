import { db } from "@server/lib/db";
import { taxReturns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { downloadACK } from "@server/_core/integrations/irs/fire-api";
import { parseACKFile, processACKRecords } from "@server/_core/integrations/irs/ack-processor";

/**
 * Poll the IRS FIRE system for new acknowledgment files.
 */
export async function pollForACKs(): Promise<void> {
  console.log("[ACKMonitor] Polling IRS FIRE for acknowledgments...");

  try {
    const ackFiles = await downloadACK();

    if (ackFiles.length === 0) {
      console.log("[ACKMonitor] No new ACK files found.");
      return;
    }

    for (const file of ackFiles) {
      console.log(`[ACKMonitor] Processing ACK file: ${file.filename}`);
      const records = parseACKFile(file.content);
      await processNewACKs(records);
    }
  } catch (err) {
    console.error(
      "[ACKMonitor] Error polling for ACKs:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Process a batch of newly received ACK records.
 */
export async function processNewACKs(
  acks: Array<{
    ackNumber: string;
    returnType: string;
    status: "accepted" | "rejected" | "accepted_with_errors";
    errorCodes?: string[];
    timestamp: Date;
  }>
): Promise<void> {
  const result = await processACKRecords(acks);

  console.log(
    `[ACKMonitor] Processed ${result.processed} ACKs: ` +
    `${result.accepted} accepted, ${result.rejected} rejected`
  );

  if (result.errors.length > 0) {
    console.error("[ACKMonitor] ACK errors:", result.errors);
  }
}
