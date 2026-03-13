import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const auditLogs = pgTable("audit_logs", {
  logId: uuid("log_id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.accountId),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  changes: jsonb("changes").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
