import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Auth-specific audit log.
 * userId is nullable because events like failed logins may have no user context.
 */
export const authAuditLogs = pgTable("auth_audit_logs", {
  logId: uuid("log_id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  email: text("email"),
  event: text("event").notNull(), // registered | login_success | login_failed | logout | token_refresh
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
