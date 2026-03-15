import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { clients } from "./clients";
import { preparers } from "./preparers";

export const taxReturns = pgTable("tax_returns", {
  returnId: uuid("return_id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.accountId),
  clientId: uuid("client_id").notNull().references(() => clients.clientId),
  preparerId: uuid("preparer_id").references(() => preparers.preparerId),
  taxYear: integer("tax_year").notNull(),
  returnType: text("return_type").notNull(), // 1040, 1040-SR, 1041, 1120, etc.
  filingStatus: text("filing_status"),
  status: text("status").default("draft").notNull(),
  draftData: jsonb("draft_data").$type<Record<string, unknown>>().default({}),
  calculations: jsonb("calculations").$type<Record<string, unknown>>().default({}),
  transmittalStatus: text("transmittal_status").default("pending"),
  ackNumber: text("ack_number"),
  refundAmount: text("refund_amount"),
  refundStatus: text("refund_status"),
  lastRefundCheckAt: timestamp("last_refund_check_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stateFilings = pgTable("state_filings", {
  stateFilingId: uuid("state_filing_id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").notNull().references(() => taxReturns.returnId),
  state: text("state").notNull(),
  status: text("status").default("draft").notNull(),
  stateFormData: jsonb("state_form_data").$type<Record<string, unknown>>().default({}),
  transmittalReference: text("transmittal_reference"),
  refundAmount: text("refund_amount"),
  refundStatus: text("refund_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
