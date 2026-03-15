import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "./trpc";
import { accounts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export const adminAccountRouter = createTRPCRouter({
  getSettings: adminProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.accountId, input.accountId),
      });

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      return account;
    }),

  updateSettings: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        firmName: z.string().min(1).optional(),
        firmType: z.string().optional(),
        eroNumber: z.string().optional(),
        stateRegistrations: z.array(z.string()).optional(),
        adminContactEmail: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { accountId, ...updates } = input;

      const existing = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.accountId, accountId),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      await ctx.db
        .update(accounts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(accounts.accountId, accountId));

      return { success: true };
    }),
});
