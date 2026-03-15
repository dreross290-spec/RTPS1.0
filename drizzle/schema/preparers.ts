import { pgTable, uuid, text, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const preparers = pgTable("preparers", {
  preparerId: uuid("preparer_id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.accountId),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  ptin: text("ptin").notNull(),
  licenses: jsonb("licenses").$type<Record<string, string>>().default({}),
  certifications: jsonb("certifications").$type<string[]>().default([]),
  ceHours: integer("ce_hours").default(0).notNull(),
  certExpiryDate: timestamp("cert_expiry_date"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
