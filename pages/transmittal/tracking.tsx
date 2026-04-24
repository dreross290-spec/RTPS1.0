/**
 * /transmittal/tracking – Protected transmittal tracking page.
 * Requires authentication.
 */

import { withAuth } from "@/client/components/auth/withAuth";
import TransmittalTrackingPage from "@/client/pages/transmittal/tracking";

export default withAuth(TransmittalTrackingPage);
