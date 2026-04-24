"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ProtectedRoute from "@/client/components/auth/ProtectedRoute";
import { useAuth, type UserRole } from "@/client/hooks/useAuth";

interface NavItem {
  label: string;
  href: string;
  icon?: string;
  /** Only render this item for these roles. Omit to show to all roles. */
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "📊" },
  { label: "Clients", href: "/admin/clients", icon: "👤" },
  { label: "Preparers", href: "/admin/preparers", icon: "✏️", roles: ["admin"] },
  { label: "Returns", href: "/admin/returns", icon: "📄" },
  { label: "Transmittal", href: "/transmittal/tracking", icon: "📤" },
  { label: "Compliance", href: "/admin/compliance", icon: "🛡️" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "📋", roles: ["admin"] },
  { label: "Settings", href: "/admin/settings", icon: "⚙️", roles: ["admin"] },
];

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

function AdminLayoutInner({ children, title }: AdminLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  async function handleLogout() {
    await logout();
    await router.replace("/auth/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: "#1e293b",
          color: "#f1f5f9",
          padding: "24px 0",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "0 20px 24px",
            borderBottom: "1px solid #334155",
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#38bdf8" }}>
            RTPS
          </h1>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>
            Tax Return Platform
          </p>
        </div>

        <nav style={{ flex: 1 }}>
          {visibleNav.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 20px",
                  color: isActive ? "#38bdf8" : "#cbd5e1",
                  backgroundColor: isActive ? "#0f172a" : "transparent",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  borderLeft: isActive ? "3px solid #38bdf8" : "3px solid transparent",
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        {user && (
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #334155",
              marginTop: "auto",
            }}
          >
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
              Signed in as
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#f1f5f9",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 4,
              }}
            >
              {user.email}
            </div>
            <div
              style={{
                display: "inline-block",
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 9999,
                background: user.role === "admin" ? "#1d4ed8" : "#334155",
                color: "#e2e8f0",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 10,
              }}
            >
              {user.role}
            </div>
            <button
              onClick={() => void handleLogout()}
              style={{
                display: "block",
                width: "100%",
                padding: "7px 0",
                borderRadius: 6,
                background: "transparent",
                border: "1px solid #475569",
                color: "#94a3b8",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, background: "#f8fafc", overflow: "auto" }}>
        {title && (
          <header
            style={{
              padding: "20px 32px",
              background: "#fff",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1e293b" }}>
              {title}
            </h2>
          </header>
        )}
        <div style={{ padding: 32 }}>{children}</div>
      </main>
    </div>
  );
}

export default function AdminLayout(props: AdminLayoutProps) {
  return (
    <ProtectedRoute allowedRoles={["admin", "staff"]}>
      <AdminLayoutInner {...props} />
    </ProtectedRoute>
  );
}
