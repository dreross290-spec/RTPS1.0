/**
 * Webhook Processor Worker
 * Processes unprocessed webhook events from provider_webhooks table.
 */
import { TwilioWebhookHandler } from "../_core/integrations/twilio/webhook-handler.js";
import { SendGridWebhookHandler } from "../_core/integrations/sendgrid/webhook-handler.js";
import { db } from "../context.js";
import { providerWebhooks } from "../../drizzle/schema/index.js";
import { isNull, eq } from "drizzle-orm";

const twilioHandler = new TwilioWebhookHandler();
const sendgridHandler = new SendGridWebhookHandler();

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
        await twilioHandler.handleDeliveryStatus(webhook.payload as Parameters<typeof twilioHandler.handleDeliveryStatus>[0]);
      } else if (webhook.provider === "sendgrid") {
        await sendgridHandler.handleEmailEvent(webhook.payload as Parameters<typeof sendgridHandler.handleEmailEvent>[0]);
      }
      await db
        .update(providerWebhooks)
        .set({ processedAt: new Date() })
        .where(eq(providerWebhooks.webhookId, webhook.webhookId));
    } catch (err) {
      console.error(JSON.stringify({ level: "error", webhookId: webhook.webhookId, error: String(err) }));
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
