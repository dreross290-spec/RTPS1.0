import { defineConfig } from "drizzle-kit";

const config = defineConfig({
  schema: "./drizzle/schema",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgresql://user:password@localhost:5432/rtps",
  },
  verbose: true,
  strict: true,
});

export default config;

