"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { getMe, login as loginApi, logout as logoutApi, register as registerApi } from "@/client/lib/auth";
import type { AuthUser } from "@/client/lib/auth";

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: "admin" | "staff") => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isStaff: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getMe().then((me) => {
      if (!cancelled) {
        setUser(me);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginApi(email, password);
      setUser(res.user);
      const redirect = new URLSearchParams(window.location.search).get("redirect");
      await router.push(redirect ?? "/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const register = useCallback(
    async (email: string, password: string, role: "admin" | "staff" = "staff") => {
      setLoading(true);
      setError(null);
      try {
        const res = await registerApi(email, password, role);
        setUser(res.user);
        await router.push("/admin/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await logoutApi();
      setUser(null);
      await router.push("/auth/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAdmin: user?.role === "admin",
    isStaff: user?.role === "staff",
  };
}
