import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.accountId),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("staff"), // admin | staff
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
