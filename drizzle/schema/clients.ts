import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const clients = pgTable("clients", {
  clientId: uuid("client_id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.accountId),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  ssnEncrypted: text("ssn_encrypted").notNull(),
  dob: text("dob").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  filingStatus: text("filing_status"), // single, married_filing_jointly, etc.
  notificationPreferences: text("notification_preferences").default("both"), // sms, email, both, none
  smsOptOut: text("sms_opt_out").default("false"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
