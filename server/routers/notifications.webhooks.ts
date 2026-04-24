/**
 * Notification Webhooks Router
 *
 * Handles inbound webhooks from Twilio (SMS delivery events) and SendGrid
 * (email engagement events), plus a public unsubscribe endpoint.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { notificationPreferences } from "../../drizzle/schema/index.js";
import { TwilioWebhookHandler } from "../_core/integrations/twilio/webhook-handler.js";
import { SendGridWebhookHandler } from "../_core/integrations/sendgrid/webhook-handler.js";
import { validateUnsubscribeToken } from "../_core/notifications/compliance.js";
import { NotificationLogger } from "../_core/audit/notification-logger.js";

export const webhooksRouter = router({
  twilioSMS: publicProcedure
    .input(
      z.object({
        payload: z.record(z.unknown()),
        twilioSignature: z.string().optional(),
        requestUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const handler = new TwilioWebhookHandler(ctx.db, new NotificationLogger(ctx.db));

      // Signature validation is handled outside tRPC in the Next.js API route
      await handler.handleDeliveryStatus(
        input.payload as unknown as Parameters<typeof handler.handleDeliveryStatus>[0],
        "trpc-direct",
      );
      return { success: true };
    }),

  sendgridEmail: publicProcedure
    .input(
      z.object({
        events: z.array(z.record(z.unknown())),
        signature: z.string().optional(),
        timestamp: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const handler = new SendGridWebhookHandler(ctx.db, new NotificationLogger(ctx.db));

      // Signature validation is handled outside tRPC in the Next.js API route
      await handler.handleEmailEvents(input.events as unknown as Parameters<typeof handler.handleEmailEvents>[0]);

      return { success: true, processed: input.events.length };
    }),

  unsubscribe: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const clientId = validateUnsubscribeToken(input.token);

      if (!clientId) {
        return { success: false, error: "Invalid or expired unsubscribe token" };
      }

      await ctx.db
        .update(notificationPreferences)
        .set({ emailEnabled: false, updatedAt: new Date() })
        .where(eq(notificationPreferences.clientId, clientId));

      return { success: true, clientId };
    }),
});
