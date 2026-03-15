/**
 * CADE-2 API client
 *
 * Communicates with the IRS CADE-2 (Customer Account Data Engine 2) API to
 * retrieve account transcripts and refund status.  Implements retry logic with
 * exponential back-off and masks all PII in logs.
 */

import type { IRSTranscript, IRSRefundStatus } from "../../notifications/types.js";
import { maskTaxId } from "../../../lib/utils/masking.js";

// ─── Custom Error Types ───────────────────────────────────────────────────────

export class CADE2AuthError extends Error {
  readonly statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "CADE2AuthError";
  }
}

export class CADE2NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(ein: string, taxYear: number) {
    super(`No record found for EIN ${maskTaxId(ein)} tax year ${taxYear}`);
    this.name = "CADE2NotFoundError";
  }
}

export class CADE2RateLimitError extends Error {
  readonly statusCode = 429;
  readonly retryAfterSeconds: number;
  constructor(retryAfter = 60) {
    super(`CADE-2 API rate limit exceeded. Retry after ${retryAfter}s`);
    this.name = "CADE2RateLimitError";
    this.retryAfterSeconds = retryAfter;
  }
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface CADE2TranscriptResponse {
  ein: string;
  tax_year: number;
  filing_date?: string;
  transactions: Array<{
    code: number;
    date: string;
    amount?: number;
    description?: string;
    cycle_date?: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface CADE2StatusResponse {
  ein: string;
  tax_year: number;
  status: string;
  refund_amount_cents: number;
  expected_deposit_date?: string;
  payment_method?: "direct_deposit" | "check";
  tracking_number?: string;
  last_updated: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

export class CADE2Client {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    if (!baseUrl) throw new Error("CADE2Client: baseUrl is required");
    if (!apiKey) throw new Error("CADE2Client: apiKey is required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  /**
   * Fetches the full account transcript for the given EIN and tax year.
   * Retries up to MAX_RETRIES times with exponential backoff.
   */
  async getTranscript(ein: string, taxYear: number): Promise<IRSTranscript> {
    const path = `/v1/transcripts/${encodeURIComponent(ein)}/${taxYear}`;
    const raw = await this.requestWithRetry<CADE2TranscriptResponse>(path);

    return {
      ein: raw.ein,
      taxYear: raw.tax_year,
      ...(raw.filing_date !== undefined ? { filingDate: raw.filing_date } : {}),
      entries: (raw.transactions ?? []).map((t) => ({
        code: t.code,
        date: t.date,
        ...(t.amount !== undefined ? { amount: t.amount } : {}),
        ...(t.description !== undefined ? { description: t.description } : {}),
        ...(t.cycle_date !== undefined ? { cycleDate: t.cycle_date } : {}),
        ...(t.metadata !== undefined ? { metadata: t.metadata } : {}),
      })),
      rawData: raw as unknown as Record<string, unknown>,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetches the current refund status for the given EIN and tax year.
   */
  async getRefundStatus(ein: string, taxYear: number): Promise<IRSRefundStatus> {
    const path = `/v1/refund-status/${encodeURIComponent(ein)}/${taxYear}`;
    const raw = await this.requestWithRetry<CADE2StatusResponse>(path);

    return {
      ein: raw.ein,
      taxYear: raw.tax_year,
      irsStatus: raw.status,
      refundAmountCents: raw.refund_amount_cents,
      expectedDepositDate: raw.expected_deposit_date ?? null,
      paymentMethod: raw.payment_method ?? null,
      trackingNumber: raw.tracking_number ?? null,
      lastUpdated: raw.last_updated,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async requestWithRetry<T>(path: string): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.request<T>(path);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        // Non-retryable errors
        if (
          err instanceof CADE2AuthError ||
          err instanceof CADE2NotFoundError
        ) {
          throw err;
        }

        // Rate limit: honour retry-after
        if (err instanceof CADE2RateLimitError) {
          const delay = err.retryAfterSeconds * 1000;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      this.log("info", path, "→ request");
      response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-RTPS-Client": "rtps/1.0",
        },
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        throw new Error(`CADE-2 request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    this.log("info", path, `← ${response.status}`);

    if (response.status === 401) {
      throw new CADE2AuthError("CADE-2 authentication failed. Check API key.");
    }
    if (response.status === 404) {
      // Extract EIN/taxYear from path for a better error message
      const parts = path.split("/");
      const ein = parts[3] ?? "unknown";
      const yearStr = parts[4] ?? "0";
      throw new CADE2NotFoundError(decodeURIComponent(ein), parseInt(yearStr, 10));
    }
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "60", 10);
      throw new CADE2RateLimitError(retryAfter);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`CADE-2 API error ${response.status}: ${body.slice(0, 200)}`);
    }

    return response.json() as Promise<T>;
  }

  private log(level: "info" | "warn" | "error", path: string, message: string): void {
    // Mask API key from any accidental inclusion in logs
    const safeKey = `${this.apiKey.slice(0, 4)}****`;
    const entry = {
      level,
      service: "CADE2Client",
      path,
      apiKeyPrefix: safeKey,
      message,
      ts: new Date().toISOString(),
    };
    if (level === "error") {
      console.error(JSON.stringify(entry));
    } else if (level === "warn") {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
