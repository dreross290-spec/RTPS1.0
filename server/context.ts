/**
 * tRPC Context Factory
 *
 * Creates the request-scoped context injected into every tRPC procedure.
 * Provides a Drizzle database connection and optional authenticated user
 * session.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../drizzle/schema/index.js";
import * as schemaImport from "../drizzle/schema/index.js";

// ─── DB Singleton ─────────────────────────────────────────────────────────────

let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db !== null) return _db;

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const client = postgres(connectionString, { max: 10 });
  _db = drizzle(client, { schema: schemaImport });
  return _db;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface UserSession {
  userId: string;
  clientId: string;
  role: "admin" | "staff" | "client";
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface Context {
  db: PostgresJsDatabase<typeof schema>;
  session: UserSession | null;
  /** Raw request headers (for webhook signature validation). */
  headers: Record<string, string | string[] | undefined>;
}

export interface CreateContextOptions {
  /** HTTP request headers forwarded from the adapter. */
  headers: Record<string, string | string[] | undefined>;
  /** Session resolved by the auth middleware upstream. */
  session?: UserSession;
}

/**
 * Creates the tRPC context for each incoming request.
 */
export async function createContext(opts: CreateContextOptions): Promise<Context> {
  return {
    db: getDb(),
    session: opts.session ?? null,
    headers: opts.headers,
  };
}

/**
 * Shared database singleton for use outside of request context
 * (e.g. in routers that access the DB directly). Lazily initialised on
 * first property access so that DATABASE_URL errors surface at call time,
 * not at module load time.
 */
let _sharedDb: ReturnType<typeof getDb> | null = null;

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    if (_sharedDb === null) _sharedDb = getDb();
    return Reflect.get(_sharedDb, prop, _sharedDb);
  },
});
