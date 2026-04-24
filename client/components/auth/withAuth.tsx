"use client";

import React, { useEffect, type ComponentType } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/client/hooks/useAuth";

interface WithAuthOptions {
  /** If provided, the user must have this role. Defaults to any authenticated user. */
  requiredRole?: "admin" | "staff";
  /** Redirect path when unauthenticated. Defaults to /login. */
  redirectTo?: string;
}

/**
 * Higher-order component that guards a page behind authentication and optional
 * role checks. Unauthenticated users are redirected to /login. Users with an
 * insufficient role are redirected to /unauthorized.
 *
 * Usage:
 *   export default withAuth(MyPage);
 *   export default withAuth(AdminPage, { requiredRole: "admin" });
 */
export function withAuth<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { requiredRole, redirectTo = "/login" } = options;

  function AuthGuard(props: P) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (isLoading) return;

      if (!user) {
        void router.replace(redirectTo);
        return;
      }

      if (requiredRole && user.role !== requiredRole) {
        void router.replace("/unauthorized");
      }
    }, [user, isLoading, router]);

    if (isLoading) {
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
    if (requiredRole && user.role !== requiredRole) return null;

    return <WrappedComponent {...props} />;
  }

  const displayName =
    WrappedComponent.displayName ?? WrappedComponent.name ?? "Component";
  AuthGuard.displayName = `withAuth(${displayName})`;

  return AuthGuard;
}
