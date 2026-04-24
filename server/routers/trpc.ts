import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { db } from "@server/lib/db";
import superjson from "superjson";
import { parse as parseCookies } from "cookie";
import { verifyToken, AUTH_COOKIE_NAME } from "@server/lib/auth";

// ── Context ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "staff";
}

export interface TRPCContext {
  db: typeof db;
  req: CreateNextContextOptions["req"];
  res: CreateNextContextOptions["res"];
  session: { user: AuthUser } | null;
}

export async function createTRPCContext(
  opts: CreateNextContextOptions
): Promise<TRPCContext> {
  const { req, res } = opts;

  let session: TRPCContext["session"] = null;

  try {
    const cookieHeader = req.headers.cookie ?? "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies[AUTH_COOKIE_NAME];

    if (token) {
      const payload = await verifyToken(token);
      session = {
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      };
    }
  } catch {
    // Token missing or invalid — unauthenticated request
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
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const adminProcedure = t.procedure.use(enforceAdmin);
