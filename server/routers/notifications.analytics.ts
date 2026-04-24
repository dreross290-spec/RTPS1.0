import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../context.js";
import {
  notificationQueue,
  notificationAudit,
} from "../../drizzle/schema/index.js";
import { and, eq, gte, lte, sql, count } from "drizzle-orm";

export const analyticsRouter = router({
  getDashboard: protectedProcedure
    .input(z.object({ clientId: z.string(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 86_400_000);
      const rows = await db
        .select({
          channel: notificationQueue.channel,
          status: notificationQueue.status,
          total: count(),
        })
        .from(notificationQueue)
        .where(
          and(
            eq(notificationQueue.clientId, input.clientId),
            gte(notificationQueue.createdAt, since),
          ),
        )
        .groupBy(notificationQueue.channel, notificationQueue.status);

      const summary = { sms: {} as Record<string, number>, email: {} as Record<string, number> };
      for (const row of rows) {
        const ch = row.channel as "sms" | "email";
        summary[ch][row.status] = Number(row.total);
      }
      return { clientId: input.clientId, days: input.days, summary };
    }),

  getEngagement: protectedProcedure
    .input(z.object({ clientId: z.string(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 86_400_000);
      const actions = await db
        .select({
          action: notificationAudit.deliveryStatus,
          total: count(),
        })
        .from(notificationAudit)
        .where(gte(notificationAudit.createdAt, since))
        .groupBy(notificationAudit.deliveryStatus);

      const totals: Record<string, number> = {};
      for (const a of actions) totals[a.action] = Number(a.total);
      const sent = totals["sent"] ?? 0;
      return {
        openRate: sent ? ((totals["open"] ?? 0) / sent) * 100 : 0,
        clickRate: sent ? ((totals["click"] ?? 0) / sent) * 100 : 0,
        bounceRate: sent ? ((totals["bounce"] ?? 0) / sent) * 100 : 0,
        complaintRate: sent ? ((totals["spam_report"] ?? 0) / sent) * 100 : 0,
        totals,
      };
    }),

  getCohorts: protectedProcedure
    .input(z.object({ days: z.number().default(90) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 86_400_000);
      const rows = await db
        .select({
          channel: notificationQueue.channel,
          total: count(),
          delivered: sql<number>`SUM(CASE WHEN ${notificationQueue.status} = 'delivered' THEN 1 ELSE 0 END)`,
        })
        .from(notificationQueue)
        .where(gte(notificationQueue.createdAt, since))
        .groupBy(notificationQueue.channel);

      return rows.map((r) => ({
        channel: r.channel,
        total: Number(r.total),
        deliveryRate: Number(r.total) > 0 ? (Number(r.delivered) / Number(r.total)) * 100 : 0,
      }));
    }),
});
