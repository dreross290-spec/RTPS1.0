"use client";

/**
 * ProtectedRoute
 *
 * Wraps a page component and redirects unauthenticated users to /auth/login.
 * Optionally restricts access to specific roles (e.g. "admin" only).
 */

import React, { useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { useAuth, type UserRole } from "@/client/hooks/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  /** If provided, only users with one of these roles can view the page. */
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      void router.replace(`/auth/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      void router.replace(
        `/auth/login?next=${encodeURIComponent(router.asPath)}`
      );
    }
  }, [user, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          color: "#64748b",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
