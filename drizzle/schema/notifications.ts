import { pgTable, uuid, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { clients } from "./clients";
import { taxReturns } from "./tax-returns";
import { accounts } from "./accounts";

export const notificationTemplates = pgTable("notification_templates", {
  templateId: uuid("template_id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.accountId),
  event: text("event").notNull(),
  channel: text("channel").notNull(), // sms, email
  subject: text("subject"),
  body: text("body").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationLog = pgTable("notification_log", {
  notificationId: uuid("notification_id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").references(() => taxReturns.returnId),
  clientId: uuid("client_id").notNull().references(() => clients.clientId),
  event: text("event").notNull(),
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").default("pending"),
  externalId: text("external_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const refundStatusHistory = pgTable("refund_status_history", {
  historyId: uuid("history_id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").notNull().references(() => taxReturns.returnId),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  refundAmount: text("refund_amount"),
  source: text("source").default("irs_transcript"),
  rawResponse: jsonb("raw_response"),
  notificationSent: boolean("notification_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
