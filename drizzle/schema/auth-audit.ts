import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Auth-specific audit log.
 * accountId is nullable because events like failed logins have no account context.
 */
export const authAuditLogs = pgTable("auth_audit_logs", {
  logId: uuid("log_id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  email: text("email"),
  event: text("event").notNull(), // registered | login_success | login_failed | logout | token_refresh
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
