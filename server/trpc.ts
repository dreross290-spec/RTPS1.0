/**
 * tRPC Base Setup
 *
 * Initializes the tRPC instance with the application context.
 * Defines base router, public procedure, and protected procedure (requires
 * an authenticated session).
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { Context } from "./context.js";

// ─── Init ─────────────────────────────────────────────────────────────────────

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Auth middleware – rejects unauthenticated requests.
 */
const enforceAuthenticated = t.middleware(({ ctx, next }) => {
  if (ctx.session === null) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action.",
    });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * Admin middleware – requires admin or staff role.
 */
const enforceAdminOrStaff = t.middleware(({ ctx, next }) => {
  if (ctx.session === null) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.session.role === "client") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient permissions.",
    });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

/** Base router constructor. */
export const router = t.router;

/** Public procedure – no authentication required. */
export const publicProcedure = t.procedure;

/** Protected procedure – requires an authenticated session. */
export const protectedProcedure = t.procedure.use(enforceAuthenticated);

/** Admin/staff procedure – requires admin or staff role. */
export const adminProcedure = t.procedure.use(enforceAdminOrStaff);

/** Re-export middleware builder for composing custom middleware. */
export const middleware = t.middleware;
