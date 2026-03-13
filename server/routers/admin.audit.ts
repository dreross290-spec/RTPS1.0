import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "./trpc";
import { getAuditLogs, exportAuditLog } from "@server/_core/account-hub/audit-logger";

export const adminAuditRouter = createTRPCRouter({
  getLogs: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        userId: z.string().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { accountId, ...filters } = input;
      return getAuditLogs(accountId, filters);
    }),

  exportLog: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .mutation(async ({ input }) => {
      const logs = await exportAuditLog(input.accountId, {
        start: input.startDate,
        end: input.endDate,
      });

      return {
        count: logs.length,
        data: logs,
        exportedAt: new Date().toISOString(),
      };
    }),
});
