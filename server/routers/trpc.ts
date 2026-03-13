import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { db } from "@server/lib/db";
import superjson from "superjson";

// ── Context ───────────────────────────────────────────────────────────────────

export interface TRPCContext {
  db: typeof db;
  req: CreateNextContextOptions["req"];
  res: CreateNextContextOptions["res"];
  session: {
    user?: {
      id: string;
      accountId: string;
      role: string;
    };
  } | null;
}

export async function createTRPCContext(
  opts: CreateNextContextOptions
): Promise<TRPCContext> {
  const { req, res } = opts;

  // In production, use next-auth session or JWT validation here
  const session = null;

  return { db, req, res, session };
}

// ── tRPC Init ─────────────────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// ── Auth Middleware ───────────────────────────────────────────────────────────

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

// ── Admin Middleware ──────────────────────────────────────────────────────────

const enforceAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const { role } = ctx.session.user;
  if (!["super_admin", "firm_admin"].includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const adminProcedure = t.procedure.use(enforceAdmin);
