import { router } from "../trpc.js";
import { refundStatusRouter } from "./notifications.refund-status.js";
import { preferencesRouter } from "./notifications.preferences.js";
import { historyRouter } from "./notifications.history.js";
import { webhooksRouter } from "./notifications.webhooks.js";
import { analyticsRouter } from "./notifications.analytics.js";

export const notificationsRouter = router({
  refundStatus: refundStatusRouter,
  preferences: preferencesRouter,
  history: historyRouter,
  webhooks: webhooksRouter,
  analytics: analyticsRouter,
});

export type NotificationsRouter = typeof notificationsRouter;
