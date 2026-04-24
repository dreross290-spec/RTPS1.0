/**
 * /unauthorized – Shown when a user lacks the required role for a page.
 */

import React from "react";
import Link from "next/link";
import { useAuth } from "@/client/hooks/useAuth";

export default function UnauthorizedPage() {
  const { user } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 16,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
          Access Denied
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, marginBottom: 24 }}>
          {user
            ? `Your role (${user.role}) doesn't have permission to view this page.`
            : "You must be logged in to view this page."}
        </p>
        <Link
          href={user ? "/admin/dashboard" : "/login"}
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {user ? "Go to Dashboard" : "Sign in"}
        </Link>
      </div>
    </div>
  );
}
