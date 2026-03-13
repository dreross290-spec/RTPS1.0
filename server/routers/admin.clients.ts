import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "./trpc";
import { clients } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encryptSSN } from "@server/lib/utils/encryption";

export const adminClientsRouter = createTRPCRouter({
  list: adminProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.clients.findMany({
        where: eq(clients.accountId, input.accountId),
      });

      // Mask SSN before returning
      return rows.map((c) => ({ ...c, ssnEncrypted: "XXX-XX-XXXX" }));
    }),

  create: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        ssn: z.string().min(9),
        dob: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().length(2).optional(),
        zip: z.string().optional(),
        filingStatus: z.string().optional(),
        notificationPreferences: z.enum(["sms", "email", "both", "none"]).default("both"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ssn, ...rest } = input;
      const ssnEncrypted = encryptSSN(ssn);

      const [created] = await ctx.db
        .insert(clients)
        .values({ ...rest, ssnEncrypted })
        .returning({ clientId: clients.clientId });

      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        accountId: z.string().uuid(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notificationPreferences: z.enum(["sms", "email", "both", "none"]).optional(),
        smsOptOut: z.enum(["true", "false"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { clientId, accountId, ...updates } = input;

      await ctx.db
        .update(clients)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(eq(clients.clientId, clientId), eq(clients.accountId, accountId))
        );

      return { success: true };
    }),
});
