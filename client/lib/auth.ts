/**
 * Client-side auth utilities.
 * Communicates with the Next.js API routes at /api/auth/*.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface AuthUser {
  userId: string;
  email: string;
  role: "admin" | "staff";
}

export interface AuthResponse {
  user: AuthUser;
}

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

async function request<T>(
  path: string,
  options: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // send httpOnly cookie
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" })) as ApiError;
    throw new Error(body.error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export async function register(
  email: string,
  password: string,
  role: "admin" | "staff" = "staff"
): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await request<{ success: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await request<AuthResponse>("/api/auth/me", { method: "GET" });
    return res.user;
  } catch {
    return null;
  }
}
