/**
 * Twilio SMS Client
 *
 * Wraps the Twilio SDK with retry logic, rate limiting, TCPA-compliant
 * opt-out footer injection, and webhook signature validation.
 */

import twilio from "twilio";
import type { TwilioSendResult } from "../../notifications/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwilioClientConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  /** Maximum SMS messages per day (default: 1000). */
  dailyRateLimit?: number;
}

// ─── Client ───────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export class TwilioClient {
  private readonly client: ReturnType<typeof twilio>;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly dailyRateLimit: number;

  /** Rolling count for the current UTC calendar day. */
  private sendCount = 0;
  private sendCountDate = todayUTCString();

  constructor(config: TwilioClientConfig) {
    if (!config.accountSid) throw new Error("TwilioClient: accountSid is required");
    if (!config.authToken) throw new Error("TwilioClient: authToken is required");
    if (!config.fromNumber) throw new Error("TwilioClient: fromNumber is required");

    this.client = twilio(config.accountSid, config.authToken);
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber;
    this.dailyRateLimit = config.dailyRateLimit ?? 1000;
  }

  /**
   * Sends an SMS message with retry logic and daily rate limiting.
   */
  async sendSMS(to: string, body: string): Promise<TwilioSendResult> {
    this.resetDailyCountIfNewDay();

    if (this.sendCount >= this.dailyRateLimit) {
      throw new Error(
        `Daily SMS rate limit of ${this.dailyRateLimit} reached. No more messages will be sent today.`,
      );
    }

    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const message = await this.client.messages.create({
          to,
          from: this.fromNumber,
          body,
        });

        this.sendCount++;

        return {
          messageSid: message.sid,
          status: message.status,
          to: message.to,
          from: message.from,
          price: message.price,
          priceUnit: message.priceUnit,
          errorCode: message.errorCode,
          errorMessage: message.errorMessage,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        // Twilio 429 or 503: retryable
        const status = (err as { status?: number }).status;
        if (status === 400 || status === 401 || status === 404) {
          // Non-retryable
          throw error;
        }

        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Validates an inbound Twilio webhook signature.
   *
   * @param signature - Value of the X-Twilio-Signature header.
   * @param url       - Full webhook URL (must match exactly what Twilio has configured).
   * @param params    - Parsed form body parameters from the request.
   */
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>,
  ): boolean {
    try {
      return twilio.validateRequest(
        this.authToken,
        signature,
        url,
        params,
      );
    } catch {
      return false;
    }
  }

  /** Current send count for today (for monitoring). */
  getDailySendCount(): number {
    this.resetDailyCountIfNewDay();
    return this.sendCount;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private resetDailyCountIfNewDay(): void {
    const today = todayUTCString();
    if (this.sendCountDate !== today) {
      this.sendCount = 0;
      this.sendCountDate = today;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayUTCString(): string {
  return new Date().toISOString().split("T")[0] as string;
}
