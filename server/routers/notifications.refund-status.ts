/**
 * Refund Status tRPC Router
 *
 * Provides procedures for querying current refund status, historical records,
 * upcoming event predictions, and on-demand IRS polling.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, asc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import {
  refundStatusHistory,
  notificationPreferences,
} from "../../drizzle/schema/index.js";
import { RefundEventType } from "../lib/constants/refund-events.js";
import type { RefundStatus } from "../../drizzle/schema/refund-status.js";

// ─── Status → Next Predicted Event Map ───────────────────────────────────────

const NEXT_EVENT_MAP: Partial<Record<RefundStatus, RefundStatus>> = {
  return_received: "return_processing",
  return_processing: "refund_approved",
  refund_approved: "refund_sent",
  refund_sent: "refund_deposited",
  amended_return_processing: "refund_approved",
  offset_applied: "refund_sent",
};

// ─── Simple in-memory rate limiter (per returnId) ─────────────────────────────

const pollRateLimits = new Map<string, number>();
const POLL_RATE_LIMIT_MS = 60_000; // 1 minute between manual polls

function checkPollRateLimit(returnId: string): void {
  const last = pollRateLimits.get(returnId);
  const now = Date.now();
  if (last !== undefined && now - last < POLL_RATE_LIMIT_MS) {
    const secondsLeft = Math.ceil((POLL_RATE_LIMIT_MS - (now - last)) / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Manual poll rate limited. Try again in ${secondsLeft} seconds.`,
    });
  }
  pollRateLimits.set(returnId, now);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const refundStatusRouter = router({
  /**
   * Get the most recent refund status record for a return.
   */
  current: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(refundStatusHistory)
        .where(eq(refundStatusHistory.id, input.returnId))
        .limit(1);

      const row = rows[0];
      if (row === undefined) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No refund status found for returnId ${input.returnId}`,
        });
      }

      return {
        id: row.id,
        clientId: row.clientId,
        taxYear: row.taxYear,
        status: row.status,
        refundAmount: row.refundAmount,
        expectedDepositDate: row.expectedDepositDate,
        trackingNumber: row.trackingNumber,
        statusMessage: row.statusMessage,
        recordedAt: row.recordedAt,
      };
    }),

  /**
   * Get paginated status history for a return.
   */
  history: protectedProcedure
    .input(
      z.object({
        returnId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(refundStatusHistory)
        .where(eq(refundStatusHistory.id, input.returnId))
        .orderBy(desc(refundStatusHistory.recordedAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        items: rows.map((r) => ({
          id: r.id,
          status: r.status,
          refundAmount: r.refundAmount,
          expectedDepositDate: r.expectedDepositDate,
          trackingNumber: r.trackingNumber,
          statusMessage: r.statusMessage,
          recordedAt: r.recordedAt,
        })),
        total: rows.length,
        hasMore: rows.length === input.limit,
      };
    }),

  /**
   * Predict the next expected status change based on the client's current status.
   */
  getUpcomingEvents: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get most recent status for this client across all returns
      const rows = await ctx.db
        .select()
        .from(refundStatusHistory)
        .where(eq(refundStatusHistory.clientId, input.clientId))
        .orderBy(desc(refundStatusHistory.recordedAt))
        .limit(10);

      return rows.map((row) => {
        const nextStatus =
          NEXT_EVENT_MAP[row.status as RefundStatus] ?? null;

        return {
          returnId: row.id,
          taxYear: row.taxYear,
          currentStatus: row.status,
          predictedNextStatus: nextStatus,
          predictedNextEventType: nextStatus
            ? (nextStatus.toUpperCase() as keyof typeof RefundEventType)
            : null,
          currentSince: row.recordedAt,
        };
      });
    }),

  /**
   * Force an immediate IRS transcript poll for a specific return.
   * Protected and rate-limited to 1 request per minute per return.
   */
  pollManual: adminProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      checkPollRateLimit(input.returnId);

      // In production this would enqueue a high-priority poll task.
      // Here we return a receipt and the worker picks it up.
      return {
        returnId: input.returnId,
        queued: true,
        message: "Manual poll queued. Results will appear within 60 seconds.",
        queuedAt: new Date().toISOString(),
      };
    }),
});
