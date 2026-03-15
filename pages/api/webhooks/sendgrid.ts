import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@server/lib/db";
import { clients, notificationLog } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

interface SendGridEvent {
  event: string;
  email: string;
  sg_message_id?: string;
  timestamp?: number;
  reason?: string;
  status?: string;
  url?: string;
}

/**
 * SendGrid webhook handler for email events.
 * Configure in SendGrid Event Webhook settings.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const events = req.body as SendGridEvent[];

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    for (const event of events) {
      await processEvent(event);
    }

    res.status(200).json({ processed: events.length });
  } catch (err) {
    console.error("[SendGrid Webhook] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function processEvent(event: SendGridEvent): Promise<void> {
  const messageId = event.sg_message_id?.split(".")[0];

  switch (event.event) {
    case "delivered":
      if (messageId) {
        await db
          .update(notificationLog)
          .set({ status: "delivered", deliveredAt: new Date() })
          .where(eq(notificationLog.externalId, messageId));
      }
      break;

    case "bounce":
    case "blocked":
      if (messageId) {
        await db
          .update(notificationLog)
          .set({
            status: "failed",
            errorMessage: `Email ${event.event}: ${event.reason ?? "unknown"}`,
          })
          .where(eq(notificationLog.externalId, messageId));
      }
      break;

    case "unsubscribe":
    case "group_unsubscribe":
      // Honor unsubscribe requests
      await handleEmailUnsubscribe(event.email);
      break;

    case "spamreport":
      // Treat spam reports as unsubscribes to comply with CAN-SPAM
      await handleEmailUnsubscribe(event.email);
      break;

    case "open":
    case "click":
      // Engagement tracking (informational only)
      break;
  }
}

async function handleEmailUnsubscribe(email: string): Promise<void> {
  // Find clients with this email and update notification preferences
  const matchingClients = await db
    .select({ clientId: clients.clientId })
    .from(clients)
    .where(eq(clients.email, email));

  for (const client of matchingClients) {
    await db
      .update(clients)
      .set({
        notificationPreferences: "sms", // downgrade to SMS only
        updatedAt: new Date(),
      })
      .where(eq(clients.clientId, client.clientId));
  }

  console.log(`[SendGrid] Email unsubscribe processed for ${email}`);
}
