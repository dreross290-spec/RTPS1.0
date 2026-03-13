import { router } from "./trpc.js";
import { notificationsRouter } from "./routers/index.js";

export const appRouter = router({
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
