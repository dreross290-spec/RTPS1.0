/**
 * Webhook Processor Worker
 * Processes unprocessed webhook events from provider_webhooks table.
 */
import { TwilioWebhookHandler } from "../_core/integrations/twilio/webhook-handler.js";
import { SendGridWebhookHandler } from "../_core/integrations/sendgrid/webhook-handler.js";
import { NotificationLogger } from "../_core/audit/notification-logger.js";
import { db } from "../context.js";
import { providerWebhooks } from "../../drizzle/schema/index.js";
import { isNull, eq } from "drizzle-orm";

const logger = new NotificationLogger(db);
const twilioHandler = new TwilioWebhookHandler(db, logger);
const sendgridHandler = new SendGridWebhookHandler(db, logger);

const INTERVAL_MS = 15_000;
let running = true;

async function runCycle(): Promise<void> {
  const pending = await db
    .select()
    .from(providerWebhooks)
    .where(isNull(providerWebhooks.processedAt))
    .limit(50);

  for (const webhook of pending) {
    try {
      if (webhook.provider === "twilio") {
        await twilioHandler.handleDeliveryStatus(
          webhook.body as unknown as Parameters<typeof twilioHandler.handleDeliveryStatus>[0],
          webhook.id,
        );
      } else if (webhook.provider === "sendgrid") {
        await sendgridHandler.handleEmailEvents(
          [webhook.body] as unknown as Parameters<typeof sendgridHandler.handleEmailEvents>[0],
        );
      }
      await db
        .update(providerWebhooks)
        .set({ processedAt: new Date() })
        .where(eq(providerWebhooks.id, webhook.id));
    } catch (err) {
      console.error(JSON.stringify({ level: "error", webhookId: webhook.id, error: String(err) }));
    }
  }
}

async function loop(): Promise<void> {
  while (running) {
    await runCycle().catch((err) =>
      console.error(JSON.stringify({ level: "error", message: "Webhook cycle error", error: String(err) })),
    );
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

loop();
console.log(JSON.stringify({ level: "info", message: "Webhook processor started" }));

function shutdown() {
  running = false;
  setTimeout(() => process.exit(0), 3000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
