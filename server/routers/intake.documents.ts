import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { intakeDocuments } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { normalizeIncomeData } from "@server/_core/tax-operations/intake/form-parser";

export const intakeDocumentsRouter = createTRPCRouter({
  upload: protectedProcedure
    .input(
      z.object({
        returnId: z.string().uuid(),
        documentType: z.string(),
        storageKey: z.string(),
        parsedData: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .insert(intakeDocuments)
        .values({
          returnId: input.returnId,
          documentType: input.documentType,
          storageKey: input.storageKey,
          parsedData: input.parsedData ?? {},
          status: "uploaded",
        })
        .returning({ documentId: intakeDocuments.documentId });

      return doc;
    }),

  list: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.intakeDocuments.findMany({
        where: eq(intakeDocuments.returnId, input.returnId),
      });
    }),

  parse: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.query.intakeDocuments.findFirst({
        where: eq(intakeDocuments.documentId, input.documentId),
      });

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }

      // Parse the document based on type
      const parsed = normalizeIncomeData([
        { type: doc.documentType, data: (doc.parsedData ?? {}) as Record<string, unknown> },
      ]);

      await ctx.db
        .update(intakeDocuments)
        .set({ parsedData: (parsed[0] as unknown) as Record<string, unknown>, status: "parsed" })
        .where(eq(intakeDocuments.documentId, input.documentId));

      return { success: true, parsed: parsed[0] };
    }),
});
