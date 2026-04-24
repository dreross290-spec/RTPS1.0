/**
 * useAuth hook
 *
 * Fetches the current user from /api/auth/me on mount.
 * Provides login, register, and logout helpers that hit the auth API routes.
 * All API calls use NEXT_PUBLIC_API_URL as base URL (falls back to relative).
 */

import { useState, useEffect, useCallback } from "react";

export type UserRole = "admin" | "staff";

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  accountId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const fetchMe = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const data: AuthUser = await res.json();
        setState({ user: data, loading: false, error: null });
      } else {
        setState({ user: null, loading: false, error: null });
      }
    } catch {
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: data.error ?? "Login failed",
        }));
        throw new Error(data.error ?? "Login failed");
      }
      setState({ user: data as AuthUser, loading: false, error: null });
    },
    []
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      role: UserRole = "staff",
      accountId?: string
    ): Promise<void> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role, accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: data.error ?? "Registration failed",
        }));
        throw new Error(data.error ?? "Registration failed");
      }
      setState({ user: data as AuthUser, loading: false, error: null });
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    await apiFetch("/api/auth/me", { method: "POST" });
    setState({ user: null, loading: false, error: null });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    login,
    register,
    logout,
    refetch: fetchMe,
  };
}
