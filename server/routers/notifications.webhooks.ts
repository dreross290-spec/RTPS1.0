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
import { TwilioWebhookHandler } from "../../_core/integrations/twilio/webhook-handler.js";
import { SendGridWebhookHandler } from "../../_core/integrations/sendgrid/webhook-handler.js";
import { validateUnsubscribeToken } from "../../_core/notifications/compliance.js";

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
      const handler = new TwilioWebhookHandler(ctx.db);

      const isValid = input.twilioSignature && input.requestUrl
        ? handler.validateSignature(
            input.twilioSignature,
            input.requestUrl,
            input.payload as Record<string, string>,
          )
        : true; // allow without signature in dev/test

      if (!isValid) {
        return { success: false, error: "Invalid Twilio signature" };
      }

      await handler.handleDeliveryStatus(input.payload as Record<string, string>);
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
      const handler = new SendGridWebhookHandler(ctx.db);

      if (input.signature && input.timestamp) {
        const isValid = handler.validateSignature(
          input.signature,
          input.timestamp,
          JSON.stringify(input.events),
        );
        if (!isValid) {
          return { success: false, error: "Invalid SendGrid signature" };
        }
      }

      for (const event of input.events) {
        await handler.handleEvent(event as Record<string, unknown>);
      }

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
