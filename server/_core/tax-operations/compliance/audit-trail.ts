import { db } from "@server/lib/db";
import { auditLogs } from "@/drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface RecordChangeParams {
  accountId: string;
  userId: string;
  returnId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Record any change to the audit trail.
 */
export async function recordChange(params: RecordChangeParams): Promise<void> {
  await db.insert(auditLogs).values({
    accountId: params.accountId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    changes: {
      before: params.before,
      after: params.after,
      returnId: params.returnId,
    },
    ipAddress: params.ipAddress,
  });
}

/**
 * Retrieve the full history of changes for a specific return.
 */
export async function getReturnHistory(returnId: string) {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.entityId, returnId))
    .orderBy(desc(auditLogs.timestamp));
}

/**
 * Generate a compliance report for an account within a date range.
 */
export async function generateComplianceReport(
  accountId: string,
  dateRange: DateRange
): Promise<{
  accountId: string;
  period: { start: string; end: string };
  totalActions: number;
  actionBreakdown: Record<string, number>;
  userBreakdown: Record<string, number>;
  logs: unknown[];
}> {
  const logs = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.accountId, accountId),
        gte(auditLogs.timestamp, dateRange.start),
        lte(auditLogs.timestamp, dateRange.end)
      )
    )
    .orderBy(desc(auditLogs.timestamp));

  const actionBreakdown: Record<string, number> = {};
  const userBreakdown: Record<string, number> = {};

  logs.forEach((log) => {
    actionBreakdown[log.action] = (actionBreakdown[log.action] ?? 0) + 1;
    userBreakdown[log.userId] = (userBreakdown[log.userId] ?? 0) + 1;
  });

  return {
    accountId,
    period: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
    totalActions: logs.length,
    actionBreakdown,
    userBreakdown,
    logs,
  };
}
