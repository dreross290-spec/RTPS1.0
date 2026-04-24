/**
 * Auth API client helpers
 *
 * Thin wrappers around the /api/auth/* endpoints.
 * Uses NEXT_PUBLIC_API_URL when set (useful for cross-origin deployments),
 * otherwise falls back to relative paths.
 */

// NEXT_PUBLIC_API_URL is injected at build time by Next.js for browser access.
// Falls back to relative paths when not set (same-origin deployment).
const BASE = (process.env["NEXT_PUBLIC_API_URL"] ?? "").replace(/\/$/, "");

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "staff";
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface AuthError {
  error: string;
  details?: Record<string, string[]>;
}

async function authFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });

  const data = (await res.json()) as T | AuthError;

  if (!res.ok) {
    const err = data as AuthError;
    throw new Error(err.error ?? "Request failed");
  }

  return data as T;
}

export async function registerUser(
  email: string,
  password: string,
  role: "admin" | "staff" = "staff"
): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCurrentUser(): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/api/auth/me");
}

export async function logoutUser(): Promise<void> {
  await authFetch<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}
