import { db } from "@server/lib/db";
import { taxReturns, transmittalHistory } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ACKRecord {
  ackNumber: string;
  returnType: string;
  status: "accepted" | "rejected" | "accepted_with_errors";
  errorCodes?: string[];
  submissionId?: string;
  timestamp: Date;
}

export interface ACKProcessingResult {
  processed: number;
  accepted: number;
  rejected: number;
  errors: string[];
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Parse an IRS ACK file (fixed-width or XML format).
 */
export function parseACKFile(content: string): ACKRecord[] {
  const records: ACKRecord[] = [];

  // Try XML format first
  if (content.trimStart().startsWith("<?xml") || content.includes("<ACK")) {
    return parseXMLACK(content);
  }

  // Fall back to fixed-width format
  const lines = content.split("\n").filter(Boolean);
  for (const line of lines) {
    if (line.length < 20) continue;

    const ackNumber = line.substring(0, 20).trim();
    const statusCode = line.substring(20, 21).trim();
    const errorField = line.substring(21).trim();
    const errorCodes = errorField ? errorField.split(",").map((e) => e.trim()) : [];

    records.push({
      ackNumber,
      returnType: "1040",
      status:
        statusCode === "A"
          ? "accepted"
          : statusCode === "E"
          ? "accepted_with_errors"
          : "rejected",
      errorCodes: errorCodes.length > 0 ? errorCodes : undefined,
      timestamp: new Date(),
    });
  }

  return records;
}

/**
 * Process all ACK records — update database statuses.
 */
export async function processACKRecords(
  records: ACKRecord[]
): Promise<ACKProcessingResult> {
  const result: ACKProcessingResult = {
    processed: 0,
    accepted: 0,
    rejected: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const taxReturn = await db.query.taxReturns.findFirst({
        where: eq(taxReturns.ackNumber, record.ackNumber),
      });

      if (!taxReturn) {
        result.errors.push(`No return found for ACK ${record.ackNumber}`);
        continue;
      }

      const newStatus =
        record.status === "accepted" ? "accepted"
        : record.status === "accepted_with_errors" ? "accepted_with_errors"
        : "rejected";

      await db
        .update(taxReturns)
        .set({ transmittalStatus: newStatus, updatedAt: new Date() })
        .where(eq(taxReturns.returnId, taxReturn.returnId));

      await db.insert(transmittalHistory).values({
        returnId: taxReturn.returnId,
        transmittalType: "irs_efile",
        status: newStatus,
        ackDate: record.timestamp,
        errorDetails: record.errorCodes
          ? { codes: record.errorCodes }
          : undefined,
      });

      result.processed++;
      if (record.status === "accepted" || record.status === "accepted_with_errors") {
        result.accepted++;
      } else {
        result.rejected++;
      }
    } catch (err) {
      result.errors.push(
        `Error processing ACK ${record.ackNumber}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}

/**
 * Handle a rejected return — log errors and flag for review.
 */
export async function handleRejection(
  returnId: string,
  errorCodes: string[]
): Promise<void> {
  await db
    .update(taxReturns)
    .set({
      transmittalStatus: "rejected",
      updatedAt: new Date(),
    })
    .where(eq(taxReturns.returnId, returnId));

  await db.insert(transmittalHistory).values({
    returnId,
    transmittalType: "irs_efile",
    status: "rejected",
    ackDate: new Date(),
    errorDetails: { errorCodes },
  });
}

// ── Private ───────────────────────────────────────────────────────────────────

function parseXMLACK(content: string): ACKRecord[] {
  // Minimal XML ACK parser for IRS MeF format
  const records: ACKRecord[] = [];
  const ackRegex = /<ACKRecord[^>]*>([\s\S]*?)<\/ACKRecord>/g;
  let match: RegExpExecArray | null;

  while ((match = ackRegex.exec(content)) !== null) {
    const block = match[1];
    const ackNumber = extractXML(block, "AckNumber") ?? "";
    const statusCode = extractXML(block, "StatusCode") ?? "R";
    const errorCodes = (extractXML(block, "ErrorCodes") ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    records.push({
      ackNumber,
      returnType: extractXML(block, "ReturnType") ?? "1040",
      status:
        statusCode === "A"
          ? "accepted"
          : statusCode === "AE"
          ? "accepted_with_errors"
          : "rejected",
      errorCodes: errorCodes.length > 0 ? errorCodes : undefined,
      timestamp: new Date(extractXML(block, "Timestamp") ?? Date.now()),
    });
  }

  return records;
}

function extractXML(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "s").exec(block);
  return match ? match[1].trim() : null;
}
