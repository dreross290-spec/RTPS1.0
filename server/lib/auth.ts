/**
 * Auth Utilities
 *
 * JWT signing / verification (using jose) and bcrypt password helpers.
 * All secrets are read from environment variables – never hardcoded.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const JWT_ALGORITHM = "HS256";
export const JWT_COOKIE_NAME = "rtps_token";

// ─── Secret ──────────────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return new TextEncoder().encode(secret);
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? "8h";
}

// ─── Payload ─────────────────────────────────────────────────────────────────

export interface TokenPayload extends JWTPayload {
  sub: string;           // userId
  email: string;
  role: "admin" | "staff";
  accountId: string | null;
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

/**
 * Sign a JWT for an authenticated user.
 */
export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(getJwtExpiresIn())
    .sign(getJwtSecret());
}

/**
 * Verify a JWT and return its decoded payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
  });
  return payload as TokenPayload;
}

// ─── Password ─────────────────────────────────────────────────────────────────

/**
 * Hash a plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/**
 * Build a Set-Cookie header value for the JWT.
 * Uses HttpOnly + SameSite=Strict for security.
 */
export function buildAuthCookie(token: string, maxAgeSeconds = 28800): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${JWT_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/${secure}; Max-Age=${maxAgeSeconds}`;
}

/**
 * Build a Set-Cookie header that clears the auth cookie.
 */
export function clearAuthCookie(): string {
  return `${JWT_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

/**
 * Extract the JWT string from an incoming request's cookie header or
 * Authorization: Bearer header.
 */
export function extractToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  // 1. Check Authorization header
  const authHeader = headers["authorization"];
  const authStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (authStr?.startsWith("Bearer ")) {
    return authStr.slice(7);
  }

  // 2. Check cookie header
  const cookieHeader = headers["cookie"];
  const cookieStr = Array.isArray(cookieHeader)
    ? cookieHeader[0]
    : cookieHeader;
  if (cookieStr) {
    const match = cookieStr
      .split(";")
      .find((c) => c.trim().startsWith(`${JWT_COOKIE_NAME}=`));
    if (match) {
      return match.trim().slice(JWT_COOKIE_NAME.length + 1);
    }
  }

  return null;
}
