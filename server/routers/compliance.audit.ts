import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "./trpc";
import { getReturnHistory, generateComplianceReport } from "@server/_core/tax-operations/compliance/audit-trail";
import { getExceptionQueue, resolveException } from "@server/_core/tax-operations/compliance/exception-handler";

export const complianceAuditRouter = createTRPCRouter({
  getAuditTrail: adminProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getReturnHistory(input.returnId);
    }),

  generateReport: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .mutation(async ({ input }) => {
      return generateComplianceReport(input.accountId, {
        start: input.startDate,
        end: input.endDate,
      });
    }),

  getExceptions: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        status: z.enum(["open", "resolved", "escalated"]).optional(),
      })
    )
    .query(async ({ input }) => {
      return getExceptionQueue(input.accountId, input.status);
    }),

  resolveException: adminProcedure
    .input(
      z.object({
        exceptionId: z.string().uuid(),
        notes: z.string(),
        resolvedBy: z.string(),
        escalate: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return resolveException(input.exceptionId, {
        notes: input.notes,
        resolvedBy: input.resolvedBy,
        escalate: input.escalate,
      });
    }),
});
