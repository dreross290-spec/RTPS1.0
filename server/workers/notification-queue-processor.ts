/**
 * Notification Queue Processor Worker
 * Pulls pending notifications from the queue and dispatches via SMS/email.
 */
import { QueueManager } from "../_core/notifications/queue-manager.js";
import { TwilioClient } from "../_core/integrations/twilio/client.js";
import { SendGridClient } from "../_core/integrations/sendgrid/client.js";
import { NotificationLogger } from "../_core/audit/notification-logger.js";
import { maskPhone, maskEmail } from "../lib/utils/masking.js";
import type { NotificationQueueItem } from "../_core/notifications/types.js";

const queueManager = new QueueManager();
const twilioClient = new TwilioClient(
  process.env["TWILIO_ACCOUNT_SID"] ?? "",
  process.env["TWILIO_AUTH_TOKEN"] ?? "",
  process.env["TWILIO_PHONE_NUMBER"] ?? "",
);
const sendGridClient = new SendGridClient(process.env["SENDGRID_API_KEY"] ?? "");
const logger = new NotificationLogger();

const BATCH_SIZE = Number(process.env["NOTIFICATION_QUEUE_BATCH_SIZE"] ?? 100);
const INTERVAL_MS = 30_000;

async function processItem(item: NotificationQueueItem): Promise<void> {
  try {
    if (item.channel === "sms") {
      await twilioClient.sendSMS(item.recipient, item.content);
      await queueManager.markSent(item.queueId, `twilio-${Date.now()}`);
      await logger.logNotificationSent(item.queueId, { type: "phone", masked: maskPhone(item.recipient) });
    } else {
      await sendGridClient.sendEmail(item.recipient, item.templateId ?? "", {});
      await queueManager.markSent(item.queueId, `sendgrid-${Date.now()}`);
      await logger.logNotificationSent(item.queueId, { type: "email", masked: maskEmail(item.recipient) });
    }
  } catch (err) {
    const retryCount = (item.retryCount ?? 0) + 1;
    await queueManager.markFailed(item.queueId, String(err), retryCount);
    console.error(JSON.stringify({ level: "error", queueId: item.queueId, error: String(err) }));
  }
}

async function runCycle(): Promise<void> {
  const items = await queueManager.dequeue(BATCH_SIZE);
  if (items.length > 0) {
    console.log(JSON.stringify({ level: "info", message: `Processing ${items.length} notifications` }));
    await Promise.allSettled(items.map(processItem));
  }
}

let running = true;

async function loop(): Promise<void> {
  while (running) {
    await runCycle().catch((err) =>
      console.error(JSON.stringify({ level: "error", message: "Cycle error", error: String(err) })),
    );
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

loop();
console.log(JSON.stringify({ level: "info", message: "Notification queue processor started" }));

function shutdown() {
  running = false;
  console.log(JSON.stringify({ level: "info", message: "Shutting down queue processor" }));
  setTimeout(() => process.exit(0), 5000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
