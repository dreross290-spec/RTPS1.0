import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@server/lib/db";
import { clients, notificationLog } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Twilio webhook handler for incoming delivery status callbacks (TCPA compliance).
 *
 * Configure this URL in your Twilio console as the Status Callback URL
 * for your messaging service.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      MessageSid,
      MessageStatus,
      To,
      From,
      ErrorCode,
      ErrorMessage,
      OptOutType,
    } = req.body as {
      MessageSid?: string;
      MessageStatus?: string;
      To?: string;
      From?: string;
      ErrorCode?: string;
      ErrorMessage?: string;
      OptOutType?: string;
    };

    // Handle TCPA opt-out (STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT)
    if (OptOutType && ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(OptOutType.toUpperCase())) {
      if (To) {
        await handleSMSOptOut(To);
      }
    }

    // Update delivery status in notification log
    if (MessageSid && MessageStatus) {
      await db
        .update(notificationLog)
        .set({
          status: mapTwilioStatus(MessageStatus),
          deliveredAt: MessageStatus === "delivered" ? new Date() : undefined,
          errorMessage: ErrorMessage ?? null,
          sentAt: MessageStatus === "sent" ? new Date() : undefined,
        })
        .where(eq(notificationLog.externalId, MessageSid));
    }

    res.status(200).end();
  } catch (err) {
    console.error("[Twilio Webhook] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function handleSMSOptOut(phoneNumber: string): Promise<void> {
  // Normalize phone for lookup
  const normalized = phoneNumber.replace(/\D/g, "");

  // Mark all matching clients as SMS opted out (TCPA compliance)
  await db
    .update(clients)
    .set({ smsOptOut: "true", updatedAt: new Date() })
    .where(eq(clients.phone, normalized));

  console.log(`[TCPA] SMS opt-out recorded for ${phoneNumber}`);
}

function mapTwilioStatus(status: string): string {
  const map: Record<string, string> = {
    queued: "queued",
    sending: "sending",
    sent: "sent",
    delivered: "delivered",
    undelivered: "failed",
    failed: "failed",
  };
  return map[status] ?? status;
}
