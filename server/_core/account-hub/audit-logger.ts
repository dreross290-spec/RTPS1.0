import { db } from "@server/lib/db";
import { auditLogs } from "@/drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface LogActionParams {
  accountId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Persist a single audit log entry.
 */
export async function logAction(params: LogActionParams): Promise<void> {
  await db.insert(auditLogs).values({
    accountId: params.accountId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    changes: params.changes ?? {},
    ipAddress: params.ipAddress,
  });
}

/**
 * Retrieve audit logs for an account with optional filters.
 */
export async function getAuditLogs(
  accountId: string,
  filters: AuditLogFilters = {}
) {
  const conditions = [eq(auditLogs.accountId, accountId)];

  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.entityType) {
    conditions.push(eq(auditLogs.entityType, filters.entityType));
  }
  if (filters.entityId) {
    conditions.push(eq(auditLogs.entityId, filters.entityId));
  }
  if (filters.startDate) {
    conditions.push(gte(auditLogs.timestamp, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(auditLogs.timestamp, filters.endDate));
  }

  const query = db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.timestamp))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);

  return query;
}

/**
 * Export all audit logs for an account within a date range as a JSON array.
 * In production this should stream to S3 or similar; here we return the array.
 */
export async function exportAuditLog(
  accountId: string,
  dateRange: DateRange
): Promise<Record<string, unknown>[]> {
  const rows = await db
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

  return rows.map((row) => ({
    logId: row.logId,
    accountId: row.accountId,
    userId: row.userId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    changes: row.changes,
    ipAddress: row.ipAddress,
    timestamp: row.timestamp.toISOString(),
  }));
}
