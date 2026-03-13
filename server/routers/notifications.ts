import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { clients, notificationLog, taxReturns } from "@/drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { checkRefundStatus } from "@server/workers/refund-notification";

export const notificationsRouter = createTRPCRouter({
  getPreferences: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.db.query.clients.findFirst({
        where: eq(clients.clientId, input.clientId),
      });

      if (!client) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        notificationPreferences: client.notificationPreferences,
        smsOptOut: client.smsOptOut === "true",
      };
    }),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        notificationPreferences: z.enum(["sms", "email", "both", "none"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(clients)
        .set({
          notificationPreferences: input.notificationPreferences,
          updatedAt: new Date(),
        })
        .where(eq(clients.clientId, input.clientId));

      return { success: true };
    }),

  optOut: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        channel: z.enum(["sms", "email", "all"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, string> = {};

      if (input.channel === "sms" || input.channel === "all") {
        updates.smsOptOut = "true";
      }

      if (input.channel === "all") {
        updates.notificationPreferences = "none";
      }

      await ctx.db
        .update(clients)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(clients.clientId, input.clientId));

      return { success: true };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.clientId, input.clientId))
        .orderBy(desc(notificationLog.createdAt))
        .limit(input.limit);
    }),

  getRefundStatus: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ret = await ctx.db.query.taxReturns.findFirst({
        where: eq(taxReturns.returnId, input.returnId),
      });

      if (!ret) throw new TRPCError({ code: "NOT_FOUND" });

      // Trigger a fresh check if needed
      if (ret.transmittalStatus === "accepted") {
        await checkRefundStatus(input.returnId);
      }

      const updated = await ctx.db.query.taxReturns.findFirst({
        where: eq(taxReturns.returnId, input.returnId),
      });

      return {
        refundStatus: updated?.refundStatus,
        refundAmount: updated?.refundAmount,
        lastChecked: updated?.lastRefundCheckAt,
      };
    }),
});
