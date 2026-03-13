import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "@server/routers/_app";
import { createTRPCContext } from "@server/routers/trpc";

export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError({ error, req }) {
    if (error.code === "INTERNAL_SERVER_ERROR") {
      console.error("[tRPC] Internal server error:", error);
    }
  },
});
