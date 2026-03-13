import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import {
  updateTransmittalStatus,
  getTransmittalHistory,
} from "@server/_core/tax-operations/transmittal/status-tracker";

export const transmittalTrackingRouter = createTRPCRouter({
  getStatus: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { taxReturns } = await import("@/drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const ret = await ctx.db.query.taxReturns.findFirst({
        where: eq(taxReturns.returnId, input.returnId),
      });

      return {
        transmittalStatus: ret?.transmittalStatus,
        ackNumber: ret?.ackNumber,
        refundStatus: ret?.refundStatus,
        refundAmount: ret?.refundAmount,
        lastRefundCheckAt: ret?.lastRefundCheckAt,
      };
    }),

  getHistory: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getTransmittalHistory(input.returnId);
    }),
});
