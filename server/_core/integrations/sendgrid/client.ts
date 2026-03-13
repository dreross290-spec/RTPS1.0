/**
 * SendGrid Email Client
 *
 * Wraps the @sendgrid/mail SDK with retry logic, bulk send support,
 * and ECDSA webhook signature validation via @sendgrid/eventwebhook.
 */

import sgMail from "@sendgrid/mail";
import eventWebhookPkg from "@sendgrid/eventwebhook";
import type { MailDataRequired } from "@sendgrid/mail";
import type {
  SendGridSendResult,
  EmailRecipient,
} from "../../notifications/types.js";
import { decrypt } from "../../../lib/utils/encryption.js";
import { EMAIL_GLOBAL_SETTINGS } from "../../../lib/constants/email-templates.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SendGridClientConfig {
  apiKey: string;
  /** SendGrid Event Webhook verification public key (ECDSA P-256). */
  webhookPublicKey?: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const BULK_BATCH_SIZE = 1000; // SendGrid supports up to 1000 personalizations

export class SendGridClient {
  private readonly webhookPublicKey: string | null;

  constructor(config: SendGridClientConfig) {
    if (!config.apiKey) throw new Error("SendGridClient: apiKey is required");
    sgMail.setApiKey(config.apiKey);
    this.webhookPublicKey = config.webhookPublicKey ?? null;
  }

  /**
   * Sends a single transactional email via SendGrid Dynamic Templates.
   *
   * @param toEncrypted - AES-256-GCM encrypted recipient email.
   * @param templateId  - SendGrid Dynamic Template ID (d-xxxxxx).
   * @param dynamicData - Template substitution variables.
   * @param subject     - Email subject line.
   * @param categories  - Optional SendGrid analytics categories.
   */
  async sendEmail(
    toEncrypted: string,
    templateId: string,
    dynamicData: Record<string, unknown>,
    subject: string,
    categories?: string[],
  ): Promise<SendGridSendResult> {
    const to = decrypt(toEncrypted);
    const params: {
      to: string;
      templateId: string;
      dynamicData: Record<string, unknown>;
      subject: string;
      categories?: string[];
    } = { to, templateId, dynamicData, subject };
    if (categories !== undefined) {
      params.categories = categories;
    }
    return this.sendWithRetry(params);
  }

  /**
   * Sends emails to multiple recipients in batches.
   * Each recipient gets its own encrypted address and template data.
   */
  async sendBulkEmail(recipients: EmailRecipient[]): Promise<void> {
    for (let i = 0; i < recipients.length; i += BULK_BATCH_SIZE) {
      const batch = recipients.slice(i, i + BULK_BATCH_SIZE);
      await Promise.allSettled(
        batch.map((r) =>
          this.sendEmail(
            r.toEncrypted,
            r.templateId,
            r.dynamicTemplateData,
            r.subject,
          ),
        ),
      );
    }
  }

  /**
   * Validates an inbound SendGrid Event Webhook signature using ECDSA.
   *
   * @param payload   - Raw request body string.
   * @param signature - Value of X-Twilio-Email-Event-Webhook-Signature header.
   * @param timestamp - Value of X-Twilio-Email-Event-Webhook-Timestamp header.
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string,
  ): boolean {
    if (!this.webhookPublicKey) {
      // If no public key is configured, skip validation (warn in logs)
      console.warn(JSON.stringify({
        level: "warn",
        service: "SendGridClient",
        message: "Webhook signature validation skipped: webhookPublicKey not configured",
        ts: new Date().toISOString(),
      }));
      return false;
    }

    try {
      const { EventWebhook } = eventWebhookPkg;
      const ew = new EventWebhook();
      const ecPublicKey = ew.convertPublicKeyToECDSA(this.webhookPublicKey);
      return ew.verifySignature(ecPublicKey, payload, signature, timestamp);
    } catch {
      return false;
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async sendWithRetry(params: {
    to: string;
    templateId: string;
    dynamicData: Record<string, unknown>;
    subject: string;
    categories?: string[];
  }): Promise<SendGridSendResult> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const message: MailDataRequired = {
          to: params.to,
          from: {
            email: EMAIL_GLOBAL_SETTINGS.fromEmail,
            name: EMAIL_GLOBAL_SETTINGS.fromName,
          },
          replyTo: EMAIL_GLOBAL_SETTINGS.replyTo,
          subject: params.subject,
          templateId: params.templateId,
          dynamicTemplateData: params.dynamicData,
          ...(params.categories ? { categories: params.categories } : {}),
          ...(EMAIL_GLOBAL_SETTINGS.asmGroupId
            ? { asm: { groupId: EMAIL_GLOBAL_SETTINGS.asmGroupId } }
            : {}),
          ...(EMAIL_GLOBAL_SETTINGS.ipPoolName
            ? { ipPoolName: EMAIL_GLOBAL_SETTINGS.ipPoolName }
            : {}),
        };

        const [response] = await sgMail.send(message);
        const messageId = (response.headers as Record<string, string>)["x-message-id"] ?? "";

        return {
          messageId,
          statusCode: response.statusCode,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        const statusCode = (err as { code?: number }).code;

        // Non-retryable: auth errors, invalid recipient, etc.
        if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
