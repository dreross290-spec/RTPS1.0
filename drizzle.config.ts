import type { Config } from "drizzle-kit";

const config: Config = {
  schema: "./drizzle/schema",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://user:password@localhost:5432/rtps",
  },
  verbose: true,
  strict: true,
};

export default config;
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required for drizzle-kit");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema/index.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
