import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { stateFilings, taxReturns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { submitToState, checkStateStatus } from "@server/_core/tax-operations/transmittal/state-efile";
import { detectStates } from "@server/_core/tax-operations/intake/multi-state-detector";

export const transmittalStatesRouter = createTRPCRouter({
  submit: protectedProcedure
    .input(z.object({ returnId: z.string().uuid(), state: z.string().length(2) }))
    .mutation(async ({ ctx, input }) => {
      const ret = await ctx.db.query.taxReturns.findFirst({
        where: eq(taxReturns.returnId, input.returnId),
      });

      if (!ret) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Return not found." });
      }

      const payload = {
        ...(ret.draftData as Record<string, unknown>),
        returnId: ret.returnId,
        taxYear: ret.taxYear,
      };

      return submitToState(payload, input.state);
    }),

  getStatus: protectedProcedure
    .input(z.object({ stateFilingId: z.string().uuid() }))
    .query(async ({ input }) => {
      return checkStateStatus(input.stateFilingId);
    }),

  setupMultiState: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ret = await ctx.db.query.taxReturns.findFirst({
        where: eq(taxReturns.returnId, input.returnId),
      });

      if (!ret) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Return not found." });
      }

      const draftData = ret.draftData as Record<string, unknown>;
      const detectedStates = detectStates({
        personalInfo: (draftData.personalInfo as Record<string, unknown>) ?? {},
        documents: (draftData.documents as Array<{ type: string; data: Record<string, unknown> }>) ?? [],
        interviewAnswers: [],
      });

      // Create state filing records for each detected state
      const created = await Promise.all(
        detectedStates.map((state) =>
          ctx.db
            .insert(stateFilings)
            .values({
              returnId: input.returnId,
              state,
              status: "draft",
            })
            .returning({ stateFilingId: stateFilings.stateFilingId })
        )
      );

      return { states: detectedStates, filings: created.map((c) => c[0]) };
    }),
});
