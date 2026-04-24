import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { db } from "@server/lib/db";
import { extractToken, verifyToken } from "@server/lib/auth";
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

  let session: TRPCContext["session"] = null;

  const token = extractToken(
    req.headers as Record<string, string | string[] | undefined>
  );

  if (token) {
    try {
      const payload = await verifyToken(token);
      session = {
        user: {
          id: payload.sub,
          accountId: payload.accountId ?? "",
          role: payload.role,
        },
      };
    } catch {
      // Invalid / expired token – treat as unauthenticated
    }
  }

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
  if (!["super_admin", "firm_admin", "admin"].includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const adminProcedure = t.procedure.use(enforceAdmin);
