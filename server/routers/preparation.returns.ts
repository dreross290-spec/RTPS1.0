import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { taxReturns } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { validateReturn } from "@server/_core/tax-operations/preparation/validation-engine";

export const preparationReturnsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ret = await ctx.db.query.taxReturns.findFirst({
        where: eq(taxReturns.returnId, input.returnId),
      });

      if (!ret) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Return not found." });
      }

      return ret;
    }),

  update: protectedProcedure
    .input(
      z.object({
        returnId: z.string().uuid(),
        draftData: z.record(z.unknown()).optional(),
        filingStatus: z.string().optional(),
        preparerId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { returnId, ...updates } = input;

      await ctx.db
        .update(taxReturns)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(taxReturns.returnId, returnId));

      return { success: true };
    }),

  recalculate: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(taxReturns)
        .set({ status: "calculation_pending", updatedAt: new Date() })
        .where(eq(taxReturns.returnId, input.returnId));

      return { queued: true };
    }),

  validate: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ret = await ctx.db.query.taxReturns.findFirst({
        where: eq(taxReturns.returnId, input.returnId),
      });

      if (!ret) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Return not found." });
      }

      const calculations = (ret.calculations ?? {}) as Record<string, number>;
      const draftData = (ret.draftData ?? {}) as Record<string, unknown>;

      const returnData = {
        taxYear: ret.taxYear,
        filingStatus: ret.filingStatus as "single" | "married_filing_jointly" | "married_filing_separately" | "head_of_household" | "qualifying_widow",
        agi: calculations.agi ?? 0,
        taxableIncome: calculations.taxableIncome ?? 0,
        totalTax: calculations.totalTax ?? 0,
        withholding: calculations.withholding ?? 0,
        credits: calculations as Record<string, number>,
        deductions: (draftData.deductions as Record<string, unknown>) ?? {},
        dependents: (draftData.dependents as Array<{
          firstName: string;
          lastName: string;
          ssn: string;
          dob: string;
          relationship: string;
          monthsLived: number;
          income: number;
          support: number;
          isStudent: boolean;
          isDisabled: boolean;
        }>) ?? [],
        income: calculations as Record<string, number>,
      };

      const result = validateReturn(returnData);
      return result;
    }),
});
