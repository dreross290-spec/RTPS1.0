import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { taxReturns } from "./tax-returns";

export const transmittalHistory = pgTable("transmittal_history", {
  transmittalId: uuid("transmittal_id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").notNull().references(() => taxReturns.returnId),
  transmittalType: text("transmittal_type").notNull(), // irs_efile, state_efile, paper
  status: text("status").default("submitted").notNull(),
  ackDate: timestamp("ack_date"),
  errorDetails: jsonb("error_details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
