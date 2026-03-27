/**
 * Treasury Offset Program (TOP) Offset Checker
 *
 * High-level helper that wraps the BFSClient to determine whether a refund
 * will be (or has been) reduced by debt offsets managed by the Treasury
 * Offset Program.
 *
 * Uses:
 *   - Check a refund *before* it is disbursed to warn the client proactively.
 *   - Retrieve final offset details *after* disbursement for the PDF report.
 */

import {
  BFSClient,
  BFSNotFoundError,
  type TOPOffsetSummary,
} from "./bfs-client.js";
import { maskTaxId } from "../../../lib/utils/masking.js";

// ─── Singleton BFS client (lazy-initialised) ──────────────────────────────────

let _bfsClient: BFSClient | null = null;

function getBFSClient(): BFSClient {
  if (_bfsClient === null) {
    _bfsClient = new BFSClient(
      process.env["BFS_API_BASE_URL"] ?? "",
      process.env["BFS_API_KEY"] ?? "",
      process.env["BFS_CLIENT_ID"] ?? "",
      process.env["BFS_CLIENT_SECRET"] ?? "",
      parseInt(process.env["BFS_REQUEST_TIMEOUT_MS"] ?? "20000", 10),
    );
  }
  return _bfsClient;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OffsetCheckResult {
  /** Whether any offsets were found. */
  hasOffsets: boolean;
  /** Sum of all offset amounts in cents. */
  totalOffsetCents: number;
  /** Net refund remaining after offsets, in cents. */
  netRefundCents: number;
  /** Detailed offset breakdown (empty if none). */
  offsets: TOPOffsetSummary["offsets"];
  /** ISO 8601 timestamp when the check was performed. */
  checkedAt: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks the Treasury Offset Program for any debt offsets that will reduce
 * (or have already reduced) the taxpayer's refund.
 *
 * Returns a structured result ready for notification routing or PDF embedding.
 * If the BFS returns 404 (no record yet), a zero-offset result is returned —
 * meaning the refund has not yet been flagged for offsets.
 *
 * @param tin      - Taxpayer Identification Number (SSN or EIN).
 * @param taxYear  - 4-digit tax year (e.g. 2024).
 */
export async function checkTopOffsets(
  tin: string,
  taxYear: number,
): Promise<OffsetCheckResult> {
  const client = getBFSClient();
  const checkedAt = new Date().toISOString();

  try {
    const summary = await client.getTopOffsets(tin, taxYear);

    logInfo(tin, taxYear, `TOP check: ${summary.offsets.length} offset(s) found, total=${summary.totalOffsetCents} cents`);

    return {
      hasOffsets: summary.offsets.length > 0,
      totalOffsetCents: summary.totalOffsetCents,
      netRefundCents: summary.netRefundCents,
      offsets: summary.offsets,
      checkedAt,
    };
  } catch (err) {
    // 404 → refund not yet scheduled for offsets; treat as clean
    if (err instanceof BFSNotFoundError) {
      logInfo(tin, taxYear, "TOP check: no record found (refund not yet in offset pipeline)");
      return {
        hasOffsets: false,
        totalOffsetCents: 0,
        netRefundCents: 0,
        offsets: [],
        checkedAt,
      };
    }

    // Re-throw unexpected errors so the caller can handle / log them
    throw err;
  }
}

/**
 * Formats a dollar amount from cents for display.
 * e.g. 123456 → "$1,234.56"
 */
export function formatCentsAsDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// ─── Private ──────────────────────────────────────────────────────────────────

function logInfo(tin: string, taxYear: number, message: string): void {
  console.log(JSON.stringify({
    level: "info",
    service: "TOPOffsetChecker",
    tin: maskTaxId(tin),
    taxYear,
    message,
    ts: new Date().toISOString(),
  }));
}
