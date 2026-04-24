/**
 * /admin/audit-logs – Protected audit log page.
 * Requires admin role.
 */

import { withAuth } from "@/client/components/auth/withAuth";
import AuditLogsPage from "@/client/pages/admin/audit-logs";

export default withAuth(AuditLogsPage, { requiredRole: "admin" });
