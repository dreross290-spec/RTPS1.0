"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/client/hooks/useAuth";

interface NavItem {
  label: string;
  href: string;
  icon?: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "📊" },
  { label: "Clients", href: "/admin/clients", icon: "👤" },
  { label: "Preparers", href: "/admin/preparers", icon: "✏️" },
  { label: "Returns", href: "/admin/returns", icon: "📄" },
  { label: "Transmittal", href: "/transmittal/tracking", icon: "📤" },
  { label: "Compliance", href: "/admin/compliance", icon: "🛡️" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "📋", adminOnly: true },
  { label: "Settings", href: "/admin/settings", icon: "⚙️", adminOnly: true },
];

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const router = useRouter();
  const { user, logout, loading, isAdmin } = useAuth();

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
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
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
        <div
          style={{
            borderTop: "1px solid #334155",
            padding: "16px 20px",
            marginTop: 8,
          }}
        >
          {user && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Signed in as</p>
              <p style={{ fontSize: 13, color: "#e2e8f0", margin: "2px 0 0", wordBreak: "break-all" }}>
                {user.email}
              </p>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: isAdmin ? "#f59e0b" : "#38bdf8",
                  background: isAdmin ? "#451a03" : "#0c2a3a",
                  padding: "2px 8px",
                  borderRadius: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {user.role}
              </span>
            </div>
          )}
          <button
            onClick={() => void logout()}
            disabled={loading}
            style={{
              width: "100%",
              background: "#334155",
              color: "#e2e8f0",
              border: "none",
              borderRadius: 6,
              padding: "8px 0",
              fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            Sign out
          </button>
        </div>
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
