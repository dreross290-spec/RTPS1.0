import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { taxReturns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { submitToIRS, checkTransmittalStatus, processACK } from "@server/_core/tax-operations/transmittal/irs-efile";

export const transmittalIRSRouter = createTRPCRouter({
  submit: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ret = await ctx.db.query.taxReturns.findFirst({
        where: eq(taxReturns.returnId, input.returnId),
      });

      if (!ret) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Return not found." });
      }

      if (ret.status !== "review_approved" && ret.status !== "calculated") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Return must be approved before submitting.",
        });
      }

      const payload = {
        ...(ret.draftData as Record<string, unknown>),
        returnId: ret.returnId,
        taxYear: ret.taxYear,
        returnType: ret.returnType,
      };

      const result = await submitToIRS(payload);
      return result;
    }),

  getStatus: protectedProcedure
    .input(z.object({ ackNumber: z.string() }))
    .query(async ({ input }) => {
      return checkTransmittalStatus(input.ackNumber);
    }),

  processACK: protectedProcedure
    .input(z.object({ ackFileContent: z.string() }))
    .mutation(async ({ input }) => {
      const records = processACK(input.ackFileContent);
      return { processed: records.length, records };
    }),
});
