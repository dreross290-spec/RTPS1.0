import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "./trpc";
import { preparers } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export const adminPreparersRouter = createTRPCRouter({
  list: adminProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.preparers.findMany({
        where: eq(preparers.accountId, input.accountId),
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        ptin: z.string().min(1),
        licenses: z.record(z.string()).optional(),
        certifications: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(preparers)
        .values({
          accountId: input.accountId,
          firstName: input.firstName,
          lastName: input.lastName,
          ptin: input.ptin,
          licenses: input.licenses ?? {},
          certifications: input.certifications ?? [],
        })
        .returning();

      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        preparerId: z.string().uuid(),
        accountId: z.string().uuid(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        ptin: z.string().optional(),
        active: z.boolean().optional(),
        certExpiryDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { preparerId, accountId, ...updates } = input;

      await ctx.db
        .update(preparers)
        .set(updates)
        .where(
          and(
            eq(preparers.preparerId, preparerId),
            eq(preparers.accountId, accountId)
          )
        );

      return { success: true };
    }),

  updateCE: adminProcedure
    .input(
      z.object({
        preparerId: z.string().uuid(),
        accountId: z.string().uuid(),
        ceHours: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(preparers)
        .set({ ceHours: input.ceHours })
        .where(
          and(
            eq(preparers.preparerId, input.preparerId),
            eq(preparers.accountId, input.accountId)
          )
        );

      return { success: true };
    }),
});
