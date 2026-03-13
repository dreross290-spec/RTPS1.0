import { db } from "@server/lib/db";
import { accountAdmins, adminPermissions } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

// ── Role & Permission Types ───────────────────────────────────────────────────

export type AdminRole = "super_admin" | "firm_admin" | "preparer" | "reviewer";

export type Permission =
  | "accounts:read"
  | "accounts:write"
  | "preparers:read"
  | "preparers:write"
  | "clients:read"
  | "clients:write"
  | "returns:read"
  | "returns:write"
  | "returns:submit"
  | "transmittal:read"
  | "transmittal:write"
  | "transmittal:submit"
  | "audit:read"
  | "audit:export"
  | "compliance:read"
  | "compliance:write"
  | "notifications:read"
  | "notifications:write"
  | "permissions:read"
  | "permissions:write"
  | "users:read"
  | "users:write";

// ── Permission Matrix ─────────────────────────────────────────────────────────

export const PERMISSION_MATRIX: Record<AdminRole, Permission[]> = {
  super_admin: [
    "accounts:read",
    "accounts:write",
    "preparers:read",
    "preparers:write",
    "clients:read",
    "clients:write",
    "returns:read",
    "returns:write",
    "returns:submit",
    "transmittal:read",
    "transmittal:write",
    "transmittal:submit",
    "audit:read",
    "audit:export",
    "compliance:read",
    "compliance:write",
    "notifications:read",
    "notifications:write",
    "permissions:read",
    "permissions:write",
    "users:read",
    "users:write",
  ],
  firm_admin: [
    "accounts:read",
    "accounts:write",
    "preparers:read",
    "preparers:write",
    "clients:read",
    "clients:write",
    "returns:read",
    "returns:write",
    "returns:submit",
    "transmittal:read",
    "transmittal:write",
    "transmittal:submit",
    "audit:read",
    "compliance:read",
    "notifications:read",
    "notifications:write",
    "permissions:read",
    "users:read",
    "users:write",
  ],
  preparer: [
    "clients:read",
    "clients:write",
    "returns:read",
    "returns:write",
    "transmittal:read",
    "compliance:read",
    "notifications:read",
  ],
  reviewer: [
    "clients:read",
    "returns:read",
    "transmittal:read",
    "audit:read",
    "compliance:read",
    "notifications:read",
  ],
};

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Check whether a role has a given permission in the static matrix.
 */
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}

/**
 * Check whether a specific admin (by adminId) has a given permission.
 * Checks both the role-based matrix and any explicit grants/overrides.
 */
export async function checkPermission(
  adminId: string,
  permission: Permission
): Promise<boolean> {
  const admin = await db.query.accountAdmins.findFirst({
    where: eq(accountAdmins.adminId, adminId),
  });

  if (!admin) return false;

  const role = admin.role as AdminRole;

  // Check base role permissions
  if (hasPermission(role, permission)) return true;

  // Check explicit grants
  const explicit = await db.query.adminPermissions.findFirst({
    where: and(
      eq(adminPermissions.accountId, admin.accountId),
      eq(adminPermissions.permission, permission)
    ),
  });

  return !!explicit;
}

/**
 * Get all permissions for an admin, merging role defaults with explicit grants.
 */
export async function getAdminPermissions(adminId: string): Promise<Permission[]> {
  const admin = await db.query.accountAdmins.findFirst({
    where: eq(accountAdmins.adminId, adminId),
  });

  if (!admin) return [];

  const role = admin.role as AdminRole;
  const rolePerms = new Set<Permission>(PERMISSION_MATRIX[role] ?? []);

  const explicit = await db.query.adminPermissions.findMany({
    where: eq(adminPermissions.accountId, admin.accountId),
  });

  explicit.forEach((p) => rolePerms.add(p.permission as Permission));

  return Array.from(rolePerms);
}

/**
 * Grant an explicit permission to a role within an account.
 */
export async function grantPermission(
  accountId: string,
  role: string,
  permission: Permission
): Promise<void> {
  await db.insert(adminPermissions).values({ accountId, role, permission });
}

/**
 * Revoke an explicit permission grant.
 */
export async function revokePermission(
  accountId: string,
  role: string,
  permission: Permission
): Promise<void> {
  await db
    .delete(adminPermissions)
    .where(
      and(
        eq(adminPermissions.accountId, accountId),
        eq(adminPermissions.role, role),
        eq(adminPermissions.permission, permission)
      )
    );
}
