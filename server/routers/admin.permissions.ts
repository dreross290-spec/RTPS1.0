import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "./trpc";
import {
  hasPermission,
  grantPermission,
  revokePermission,
  PERMISSION_MATRIX,
} from "@server/_core/account-hub/permission-engine";
import { AdminRoleSchema, PermissionSchema } from "@server/lib/schemas/admin-permissions";

export const adminPermissionsRouter = createTRPCRouter({
  getMatrix: adminProcedure.query(() => {
    return PERMISSION_MATRIX;
  }),

  grant: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        role: AdminRoleSchema,
        permission: PermissionSchema,
      })
    )
    .mutation(async ({ input }) => {
      await grantPermission(input.accountId, input.role, input.permission);
      return { success: true };
    }),

  revoke: adminProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        role: AdminRoleSchema,
        permission: PermissionSchema,
      })
    )
    .mutation(async ({ input }) => {
      await revokePermission(input.accountId, input.role, input.permission);
      return { success: true };
    }),

  check: adminProcedure
    .input(
      z.object({
        role: AdminRoleSchema,
        permission: PermissionSchema,
      })
    )
    .query(({ input }) => {
      return { allowed: hasPermission(input.role, input.permission) };
    }),
});
