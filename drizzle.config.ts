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
