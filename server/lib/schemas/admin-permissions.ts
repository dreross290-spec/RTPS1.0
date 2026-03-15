import { z } from "zod";

// ── Role Definitions ──────────────────────────────────────────────────────────

export const AdminRoleSchema = z.enum([
  "super_admin",
  "firm_admin",
  "preparer",
  "reviewer",
]);

export const PermissionSchema = z.enum([
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
]);

export const PermissionMatrixSchema = z.record(
  AdminRoleSchema,
  z.array(PermissionSchema)
);

export const AdminUserSchema = z.object({
  adminId: z.string().uuid(),
  accountId: z.string().uuid(),
  userId: z.string(),
  role: AdminRoleSchema,
  mfaEnabled: z.boolean(),
  ipAllowlist: z.array(z.string()).default([]),
  lastLoginAt: z.date().optional(),
  createdAt: z.date(),
});

export const GrantPermissionSchema = z.object({
  accountId: z.string().uuid(),
  role: AdminRoleSchema,
  permission: PermissionSchema,
});

export const RevokePermissionSchema = z.object({
  accountId: z.string().uuid(),
  role: AdminRoleSchema,
  permission: PermissionSchema,
});

// ── Exported Types ────────────────────────────────────────────────────────────

export type AdminRole = z.infer<typeof AdminRoleSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type PermissionMatrix = z.infer<typeof PermissionMatrixSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type GrantPermission = z.infer<typeof GrantPermissionSchema>;
export type RevokePermission = z.infer<typeof RevokePermissionSchema>;
