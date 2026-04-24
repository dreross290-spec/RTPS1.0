/**
 * Notification History Router
 *
 * Provides endpoints for querying, viewing, and exporting notification
 * delivery history stored in the notificationAudit table.
 */

import { z } from "zod";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { notificationAudit } from "../../drizzle/schema/index.js";
import type { DeliveryStatus } from "../../drizzle/schema/index.js";

export const historyRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        pagination: z.object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          provider: z.enum(["twilio", "sendgrid"]).optional(),
          status: z.string().optional(),
        }),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { clientId, pagination } = input;
      const conditions = [eq(notificationAudit.clientId, clientId)];

      if (pagination.provider) {
        conditions.push(eq(notificationAudit.provider, pagination.provider));
      }
      if (pagination.status) {
        conditions.push(eq(notificationAudit.deliveryStatus, pagination.status as DeliveryStatus));
      }

      const rows = await ctx.db
        .select()
        .from(notificationAudit)
        .where(and(...conditions))
        .orderBy(desc(notificationAudit.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset);

      return {
        items: rows.map((r) => ({
          id: r.id,
          notificationEventId: r.notificationEventId,
          provider: r.provider,
          deliveryStatus: r.deliveryStatus,
          providerMessageId: r.providerMessageId,
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          createdAt: r.createdAt,
        })),
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
        },
      };
    }),

  get: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(notificationAudit)
        .where(eq(notificationAudit.id, input.notificationId))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const r = rows[0]!;
      return {
        id: r.id,
        notificationEventId: r.notificationEventId,
        clientId: r.clientId,
        provider: r.provider,
        deliveryStatus: r.deliveryStatus,
        providerMessageId: r.providerMessageId,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt,
      };
    }),

  export: adminProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        dateRange: z.object({
          from: z.string().datetime(),
          to: z.string().datetime(),
        }),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { clientId, dateRange } = input;

      const rows = await ctx.db
        .select()
        .from(notificationAudit)
        .where(
          and(
            eq(notificationAudit.clientId, clientId),
            gte(notificationAudit.createdAt, new Date(dateRange.from)),
            lte(notificationAudit.createdAt, new Date(dateRange.to)),
          ),
        )
        .orderBy(desc(notificationAudit.createdAt));

      const header = "id,notificationEventId,provider,deliveryStatus,providerMessageId,errorCode,errorMessage,createdAt";
      const escapeCSV = (v: unknown): string => {
        if (v == null) return "";
        const s = String(v);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const lines = rows.map((r) =>
        [
          r.id,
          r.notificationEventId,
          r.provider,
          r.deliveryStatus,
          r.providerMessageId,
          r.errorCode,
          r.errorMessage,
          r.createdAt?.toISOString() ?? "",
        ]
          .map(escapeCSV)
          .join(","),
      );

      return { csv: [header, ...lines].join("\n") };
    }),
});
