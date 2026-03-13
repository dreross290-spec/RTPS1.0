import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  accountId: uuid("account_id").primaryKey().defaultRandom(),
  firmName: text("firm_name").notNull(),
  firmType: text("firm_type").notNull(), // sole_proprietor, partnership, corporation, llc
  eroNumber: text("ero_number"),
  stateRegistrations: jsonb("state_registrations").$type<string[]>().default([]),
  adminContactEmail: text("admin_contact_email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accountAdmins = pgTable("account_admins", {
  adminId: uuid("admin_id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.accountId),
  userId: text("user_id").notNull(),
  role: text("role").notNull(), // super_admin, firm_admin, preparer, reviewer
  ipAllowlist: jsonb("ip_allowlist").$type<string[]>().default([]),
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  mfaSecret: text("mfa_secret"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminPermissions = pgTable("admin_permissions", {
  permissionId: uuid("permission_id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.accountId),
  role: text("role").notNull(),
  permission: text("permission").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
});
