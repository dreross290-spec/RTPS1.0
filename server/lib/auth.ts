/**
 * Auth Utilities
 *
 * JWT sign/verify (HS256 via jose) and bcrypt password helpers.
 * All secrets are read from environment variables — never hardcoded.
 */

import * as bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ── Constants ─────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const JWT_ALGORITHM = "HS256";
/** Token TTL in seconds (8 hours by default, override via env). */
const TOKEN_TTL_SECONDS = parseInt(
  process.env["JWT_TOKEN_TTL_SECONDS"] ?? "28800",
  10
);

// ── Secret ────────────────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env["JWT_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable must be set and at least 32 characters long"
    );
  }
  return new TextEncoder().encode(secret);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthTokenPayload extends JWTPayload {
  sub: string; // user id
  email: string;
  role: "admin" | "staff";
}

// ── Password helpers ──────────────────────────────────────────────────────────

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

export async function signToken(payload: Omit<AuthTokenPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
  });
  return payload as AuthTokenPayload;
}

/**
 * Extract the bearer token from an Authorization header or return the raw
 * string (used when the token is passed directly from a cookie).
 */
export function extractBearer(header: string): string {
  if (header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return header;
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export const AUTH_COOKIE_NAME = "rtps_auth_token";

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TOKEN_TTL_SECONDS,
};
