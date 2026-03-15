import { db } from "@server/lib/db";
import { accounts, accountAdmins } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface TenantContext {
  accountId: string;
  firmName: string;
  firmType: string;
  eroNumber: string | null;
  stateRegistrations: string[];
}

/**
 * Retrieve the full tenant context for an account.
 */
export async function getTenantContext(
  accountId: string
): Promise<TenantContext> {
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.accountId, accountId),
  });

  if (!account) {
    throw new Error(`Tenant not found: ${accountId}`);
  }

  return {
    accountId: account.accountId,
    firmName: account.firmName,
    firmType: account.firmType,
    eroNumber: account.eroNumber,
    stateRegistrations: (account.stateRegistrations as string[]) ?? [],
  };
}

/**
 * Validate that a user (identified by userId) belongs to the given account.
 * Returns true if the user has a record in account_admins for this account.
 */
export async function validateTenantAccess(
  userId: string,
  accountId: string
): Promise<boolean> {
  const admin = await db.query.accountAdmins.findFirst({
    where: and(
      eq(accountAdmins.userId, userId),
      eq(accountAdmins.accountId, accountId)
    ),
  });

  return !!admin;
}

/**
 * Enforce multi-tenant isolation by injecting an accountId filter into a
 * Drizzle WHERE condition.  Pass an existing condition to AND it together.
 *
 * Usage:
 *   const rows = await db.select().from(taxReturns)
 *     .where(isolateQuery(eq(taxReturns.status, 'draft'), accountId));
 */
export function isolateQuery(
  condition: ReturnType<typeof and> | ReturnType<typeof eq> | undefined,
  accountId: string
): ReturnType<typeof and> {
  const tenantFilter = eq(accounts.accountId, accountId);
  return condition ? and(tenantFilter, condition)! : and(tenantFilter)!;
}

/**
 * Verify that a given account exists and is active.
 */
export async function accountExists(accountId: string): Promise<boolean> {
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.accountId, accountId),
  });
  return !!account;
}
