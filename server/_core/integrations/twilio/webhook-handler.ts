/**
 * Twilio Webhook Handler
 *
 * Processes inbound Twilio status callback webhooks and incoming message
 * webhooks (e.g., STOP/HELP replies).  Updates the notification_queue,
 * logs to notification_audit, and processes opt-outs.
 */

import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../../../../drizzle/schema/index.js";
import { notificationQueue, notificationAudit, providerWebhooks } from "../../../../drizzle/schema/index.js";
import type { TwilioWebhookPayload } from "../../notifications/types.js";
import { NotificationLogger } from "../../audit/notification-logger.js";

type AppDB = PostgresJsDatabase<typeof schema>;

// ─── Status Mapping ───────────────────────────────────────────────────────────

const TWILIO_TO_QUEUE_STATUS: Record<string, import("../../../../drizzle/schema/notification-queue.js").QueueStatus> = {
  queued: "pending",
  sending: "processing",
  sent: "sent",
  delivered: "delivered",
  undelivered: "failed",
  failed: "failed",
  canceled: "failed",
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export class TwilioWebhookHandler {
  private readonly db: AppDB;
  private readonly logger: NotificationLogger;
  private readonly optOutCallback: ((clientId: string, phone: string) => Promise<void>) | null;

  constructor(
    db: AppDB,
    logger: NotificationLogger,
    optOutCallback?: (clientId: string, phone: string) => Promise<void>,
  ) {
    this.db = db;
    this.logger = logger;
    this.optOutCallback = optOutCallback ?? null;
  }

  /**
   * Handles a Twilio delivery status callback.
   * Updates the notification_queue row and writes an audit log entry.
   */
  async handleDeliveryStatus(
    payload: TwilioWebhookPayload,
    webhookId: string,
  ): Promise<void> {
    const messageSid = payload.MessageSid;
    const rawStatus = payload.MessageStatus ?? payload.SmsStatus ?? "unknown";

    // Log the raw webhook receipt
    await this.logger.logWebhookReceived(
      "twilio",
      rawStatus,
      messageSid,
      payload as unknown as Record<string, unknown>,
    );

    // Find the queue item by provider message ID
    const queueRows = await this.db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.notificationEventId, messageSid))
      .limit(1);

    // Map Twilio status to our queue status
    const mappedStatus = TWILIO_TO_QUEUE_STATUS[rawStatus.toLowerCase()];

    if (queueRows.length > 0 && mappedStatus !== undefined) {
      const queueRow = queueRows[0];
      if (queueRow !== undefined) {
        await this.db
          .update(notificationQueue)
          .set({
            status: mappedStatus,
            updatedAt: new Date(),
            ...(mappedStatus === "delivered" || mappedStatus === "failed"
              ? { processedAt: new Date() }
              : {}),
            ...(payload.ErrorMessage !== undefined
              ? { lastError: payload.ErrorMessage }
              : {}),
          })
          .where(eq(notificationQueue.id, queueRow.id));

        // Write delivery event to notification_audit
        await this.db.insert(notificationAudit).values({
          notificationEventId: queueRow.notificationEventId,
          notificationQueueId: queueRow.id,
          clientId: queueRow.clientId,
          providerMessageId: messageSid,
          provider: "twilio",
          deliveryStatus: mapToDeliveryStatus(rawStatus),
          errorCode: payload.ErrorCode ?? null,
          errorMessage: payload.ErrorMessage ?? null,
          eventTimestamp: new Date(),
          rawWebhookId: webhookId,
        });
      }
    }
  }

  /**
   * Handles an incoming Twilio message (STOP, HELP, or other reply).
   * Processes opt-outs and marks them in the audit log.
   */
  async handleIncomingMessage(payload: TwilioWebhookPayload): Promise<void> {
    const body = (payload.Body ?? "").trim().toUpperCase();
    const fromPhone = payload.From ?? "";

    if (!fromPhone) {
      return;
    }

    if (body === "STOP" || body === "STOPALL" || body === "UNSUBSCRIBE" || body === "CANCEL" || body === "QUIT") {
      await this.logger.logOptOut("unknown", "sms", `Twilio STOP reply from ${fromPhone.slice(0, 3)}***`);

      if (this.optOutCallback !== null) {
        await this.optOutCallback("unknown", fromPhone);
      }
    } else if (body === "HELP" || body === "INFO") {
      // HELP responses are handled automatically by Twilio opt-out management,
      // but we log the event for compliance.
      await this.logger.logWebhookReceived("twilio", "help_request", fromPhone, {
        from: fromPhone.slice(0, 6) + "****",
        body: "HELP",
      });
    }
  }

  /**
   * Stores a raw webhook payload in provider_webhooks before processing.
   * Returns the webhook row ID for linking to audit records.
   */
  async storeRawWebhook(
    payload: Record<string, unknown>,
    signatureVerified: boolean,
    providerMessageId?: string,
  ): Promise<string> {
    const rows = await this.db
      .insert(providerWebhooks)
      .values({
        provider: "twilio",
        body: payload,
        signatureVerified,
        providerMessageId: providerMessageId ?? null,
        processingStatus: "unprocessed",
      })
      .returning({ id: providerWebhooks.id });

    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to insert provider_webhook row");
    }
    return row.id;
  }

  /**
   * Marks a provider_webhook row as processed (or errored).
   */
  async markWebhookProcessed(webhookId: string, error?: string): Promise<void> {
    await this.db
      .update(providerWebhooks)
      .set({
        processingStatus: error !== undefined ? "error" : "processed",
        processingError: error ?? null,
        processedAt: new Date(),
      })
      .where(eq(providerWebhooks.id, webhookId));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapToDeliveryStatus(
  twilioStatus: string,
): import("../../../../drizzle/schema/notification-audit.js").DeliveryStatus {
  const lower = twilioStatus.toLowerCase();
  const map: Record<string, import("../../../../drizzle/schema/notification-audit.js").DeliveryStatus> = {
    accepted: "accepted",
    queued: "queued",
    sending: "sent",
    sent: "sent",
    delivered: "delivered",
    undelivered: "undelivered",
    failed: "failed",
    scheduled: "scheduled",
    canceled: "canceled",
    read: "read",
  };
  return map[lower] ?? "failed";
}
