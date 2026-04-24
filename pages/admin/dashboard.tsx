/**
 * /admin/dashboard – Protected admin dashboard page.
 * Requires authentication. Accessible to both admin and staff roles.
 */

import { withAuth } from "@/client/components/auth/withAuth";
import AdminDashboard from "@/client/pages/admin/dashboard";

export default withAuth(AdminDashboard);
