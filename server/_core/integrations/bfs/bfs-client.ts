/**
 * Bureau of Fiscal Services (BFS) API Client
 *
 * Integrates with the U.S. Treasury Bureau of Fiscal Services to:
 *   - Query Treasury Offset Program (TOP) debt offsets applied to a refund.
 *   - Retrieve ACH / paper-check disbursement status directly from Treasury.
 *
 * API reference: https://www.fiscal.treasury.gov/developer-resources/
 *
 * All PII (SSN, EIN) is masked in logs.  The client signs every request with
 * an HMAC-SHA256 signature using BFS_CLIENT_SECRET so Treasury can verify the
 * caller identity without exposing the secret in headers.
 */

import * as crypto from "crypto";
import { maskTaxId } from "../../../lib/utils/masking.js";

// ─── Custom Error Types ───────────────────────────────────────────────────────

export class BFSAuthError extends Error {
  readonly statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "BFSAuthError";
  }
}

export class BFSNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(tin: string, taxYear: number) {
    super(`No BFS record found for TIN ${maskTaxId(tin)} tax year ${taxYear}`);
    this.name = "BFSNotFoundError";
  }
}

export class BFSRateLimitError extends Error {
  readonly statusCode = 429;
  readonly retryAfterSeconds: number;
  constructor(retryAfter = 60) {
    super(`BFS API rate limit exceeded. Retry after ${retryAfter}s`);
    this.name = "BFSRateLimitError";
    this.retryAfterSeconds = retryAfter;
  }
}

// ─── Domain Types ─────────────────────────────────────────────────────────────

/** A single debt offset applied by the Treasury Offset Program. */
export interface TOPOffsetRecord {
  /** Unique identifier for this offset transaction. */
  offsetId: string;
  /** Agency that submitted the debt (e.g. "SSA", "HHS", "STATE:CA"). */
  creditorAgency: string;
  /** Human-readable description of the debt. */
  debtDescription: string;
  /** Amount offset in cents. */
  offsetAmountCents: number;
  /** Date the offset was applied (ISO 8601 date). */
  offsetDate: string;
  /** Original refund amount before offsets, in cents. */
  originalRefundCents: number;
  /** Net refund amount after this offset, in cents. */
  netRefundCents: number;
}

/** Summary of all TOP offsets for a given TIN / tax year. */
export interface TOPOffsetSummary {
  tin: string;
  taxYear: number;
  /** Total amount offset, in cents. */
  totalOffsetCents: number;
  /** Net refund after all offsets, in cents.  May be 0 if fully offset. */
  netRefundCents: number;
  offsets: TOPOffsetRecord[];
  fetchedAt: string;
}

/** Payment disbursement status from Treasury. */
export type DisbursementStatus =
  | "pending"
  | "scheduled"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled"
  | "unknown";

/** ACH or paper-check disbursement record. */
export interface DisbursementRecord {
  /** Treasury payment tracking reference. */
  paymentId: string;
  /** Payment method used by Treasury. */
  paymentMethod: "ach" | "check" | "debit_card" | "unknown";
  /** Current disbursement status. */
  status: DisbursementStatus;
  /** Gross amount disbursed, in cents. */
  grossAmountCents: number;
  /** Net amount disbursed after offsets, in cents. */
  netAmountCents: number;
  /** Scheduled or actual settlement date (ISO 8601 date). */
  settlementDate: string | null;
  /** Bank routing number — masked in logs. */
  routingNumber: string | null;
  /** Bank account last 4 digits. */
  accountLast4: string | null;
  /** Check number if payment method is "check". */
  checkNumber: string | null;
  /** Date Treasury last updated this record (ISO 8601). */
  lastUpdated: string;
}

// ─── Raw API Response Types ───────────────────────────────────────────────────

interface BFSOffsetResponse {
  tin: string;
  tax_year: number;
  total_offset_cents: number;
  net_refund_cents: number;
  offsets: Array<{
    offset_id: string;
    creditor_agency: string;
    debt_description: string;
    offset_amount_cents: number;
    offset_date: string;
    original_refund_cents: number;
    net_refund_cents: number;
  }>;
}

interface BFSDisbursementResponse {
  payment_id: string;
  payment_method: "ach" | "check" | "debit_card" | "unknown";
  status: DisbursementStatus;
  gross_amount_cents: number;
  net_amount_cents: number;
  settlement_date: string | null;
  routing_number: string | null;
  account_last_4: string | null;
  check_number: string | null;
  last_updated: string;
}

// ─── Client Configuration ─────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 20_000;

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * BFS API client.
 *
 * Instantiate with credentials from environment variables:
 * ```ts
 * const bfs = new BFSClient(
 *   process.env.BFS_API_BASE_URL ?? "",
 *   process.env.BFS_API_KEY ?? "",
 *   process.env.BFS_CLIENT_ID ?? "",
 *   process.env.BFS_CLIENT_SECRET ?? "",
 * );
 * ```
 */
export class BFSClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl: string,
    apiKey: string,
    clientId: string,
    clientSecret: string,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    if (!baseUrl) throw new Error("BFSClient: baseUrl is required");
    if (!apiKey) throw new Error("BFSClient: apiKey is required");
    if (!clientId) throw new Error("BFSClient: clientId is required");
    if (!clientSecret) throw new Error("BFSClient: clientSecret is required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.timeoutMs = timeoutMs;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns all Treasury Offset Program (TOP) offsets applied to the refund
   * for the given TIN (SSN or EIN) and tax year.
   */
  async getTopOffsets(tin: string, taxYear: number): Promise<TOPOffsetSummary> {
    const path = `/v1/top/offsets/${encodeURIComponent(tin)}/${taxYear}`;
    const raw = await this.requestWithRetry<BFSOffsetResponse>(path);

    return {
      tin: raw.tin,
      taxYear: raw.tax_year,
      totalOffsetCents: raw.total_offset_cents,
      netRefundCents: raw.net_refund_cents,
      offsets: raw.offsets.map((o) => ({
        offsetId: o.offset_id,
        creditorAgency: o.creditor_agency,
        debtDescription: o.debt_description,
        offsetAmountCents: o.offset_amount_cents,
        offsetDate: o.offset_date,
        originalRefundCents: o.original_refund_cents,
        netRefundCents: o.net_refund_cents,
      })),
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns the disbursement record for the given Treasury payment tracking ID.
   * The paymentId can be obtained from IRS transcript data or the CADE2 client.
   */
  async getDisbursementStatus(paymentId: string): Promise<DisbursementRecord> {
    const path = `/v1/payments/${encodeURIComponent(paymentId)}/status`;
    const raw = await this.requestWithRetry<BFSDisbursementResponse>(path);

    return {
      paymentId: raw.payment_id,
      paymentMethod: raw.payment_method,
      status: raw.status,
      grossAmountCents: raw.gross_amount_cents,
      netAmountCents: raw.net_amount_cents,
      settlementDate: raw.settlement_date,
      routingNumber: raw.routing_number,
      accountLast4: raw.account_last_4,
      checkNumber: raw.check_number,
      lastUpdated: raw.last_updated,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async requestWithRetry<T>(path: string): Promise<T> {
    let lastError: Error = new Error("Unknown BFS error");

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.request<T>(path);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        if (err instanceof BFSAuthError || err instanceof BFSNotFoundError) {
          throw err;
        }

        if (err instanceof BFSRateLimitError) {
          const delay = err.retryAfterSeconds * 1_000;
          this.log("warn", path, `Rate limited. Waiting ${delay}ms before retry ${attempt}/${MAX_RETRIES}`);
          await sleep(delay);
          continue;
        }

        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          this.log("warn", path, `Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms`);
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const timestamp = new Date().toISOString();
    const signature = this.signRequest(path, timestamp);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      this.log("info", path, "→ request");
      response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "X-BFS-Client-ID": this.clientId,
          "X-BFS-Timestamp": timestamp,
          "X-BFS-Signature": signature,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-RTPS-Client": "rtps/1.0",
        },
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        throw new Error(`BFS request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    this.log("info", path, `← ${response.status}`);

    if (response.status === 401) {
      throw new BFSAuthError("BFS authentication failed. Check API key and client credentials.");
    }
    if (response.status === 404) {
      // Extract TIN/taxYear from path for a better error message
      const parts = path.split("/");
      const tin = decodeURIComponent(parts[3] ?? "unknown");
      const yearStr = parts[4] ?? "0";
      throw new BFSNotFoundError(tin, parseInt(yearStr, 10));
    }
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "60", 10);
      throw new BFSRateLimitError(retryAfter);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`BFS API error ${response.status}: ${body.slice(0, 200)}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Produces an HMAC-SHA256 request signature so Treasury can verify the caller.
   * Signature = HMAC-SHA256( clientSecret, "{clientId}\n{path}\n{timestamp}" )
   */
  private signRequest(path: string, timestamp: string): string {
    const message = `${this.clientId}\n${path}\n${timestamp}`;
    return crypto
      .createHmac("sha256", this.clientSecret)
      .update(message)
      .digest("hex");
  }

  private log(level: "info" | "warn" | "error", path: string, message: string): void {
    const entry = {
      level,
      service: "BFSClient",
      path,
      clientIdPrefix: `${this.clientId.slice(0, 6)}****`,
      message,
      ts: new Date().toISOString(),
    };
    if (level === "error") console.error(JSON.stringify(entry));
    else if (level === "warn") console.warn(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
