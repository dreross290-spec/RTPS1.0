"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

// ─── Brand tokens (kept inline so the component is self-contained) ────────────
const NAVY      = "#0B1F44";
const NAVY_DARK = "#071530";
const NAVY_MID  = "#162E5C";
const GOLD      = "#C9A84C";
const GOLD_MUTED = "#A88930";
const TEXT_LIGHT = "#F0F4FF";
const TEXT_MUTED = "#94A3B8";

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/admin/dashboard",       icon: "📊" },
  { label: "Clients",     href: "/admin/clients",         icon: "👤" },
  { label: "Preparers",   href: "/admin/preparers",       icon: "✏️" },
  { label: "Returns",     href: "/admin/returns",         icon: "📄" },
  { label: "Transmittal", href: "/transmittal/tracking",  icon: "📤" },
  { label: "Compliance",  href: "/admin/compliance",      icon: "🛡️" },
  { label: "Audit Logs",  href: "/admin/audit-logs",      icon: "📋" },
  { label: "Reports",     href: "/admin/reports",         icon: "📑" },
  { label: "Settings",    href: "/admin/settings",        icon: "⚙️" },
];

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

/** RT shield SVG mark — matches the navy/gold brand palette. */
function RTShieldMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ross Tax Pro Software logo"
    >
      {/* Shield body */}
      <path
        d="M32 2L6 14v22c0 14.5 10.9 28.1 26 33 15.1-4.9 26-18.5 26-33V14L32 2Z"
        fill={NAVY_MID}
        stroke={GOLD}
        strokeWidth="2.5"
      />
      {/* Pillar left */}
      <rect x="8"  y="10" width="5" height="28" rx="1" fill={GOLD} />
      {/* Pillar right */}
      <rect x="51" y="10" width="5" height="28" rx="1" fill={GOLD} />
      {/* "RT" monogram */}
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontWeight="700"
        fontSize="22"
        fill={GOLD}
      >
        RT
      </text>
    </svg>
  );
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 256,
          background: NAVY,
          color: TEXT_LIGHT,
          padding: "0 0 24px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          boxShadow: "2px 0 12px rgba(0,0,0,0.35)",
        }}
      >
        {/* Brand header */}
        <div
          style={{
            padding: "24px 20px 20px",
            borderBottom: `1px solid ${NAVY_MID}`,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <RTShieldMark size={40} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: GOLD, lineHeight: 1.2 }}>
                Ross Tax Pro
              </div>
              <div style={{ fontSize: 11, color: GOLD_MUTED, lineHeight: 1.3 }}>
                Software
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              color: TEXT_MUTED,
              lineHeight: 1.5,
              borderTop: `1px solid ${NAVY_MID}`,
              paddingTop: 8,
            }}
          >
            IRS Authorized ERO · All 50 States
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => {
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
                  color: isActive ? GOLD : TEXT_LIGHT,
                  backgroundColor: isActive ? NAVY_DARK : "transparent",
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 400,
                  borderLeft: isActive ? `3px solid ${GOLD}` : "3px solid transparent",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Founder badge */}
        <div
          style={{
            margin: "16px 14px 0",
            padding: "12px 14px",
            background: NAVY_DARK,
            borderRadius: 8,
            border: `1px solid ${GOLD_MUTED}`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>
            Andreaa Chan&rsquo;nel
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
            MPA, BA · CEO &amp; Founder
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main style={{ flex: 1, background: "#F8FAFC", overflow: "auto" }}>
        {title && (
          <header
            style={{
              padding: "18px 32px",
              background: "#fff",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Gold left accent bar */}
            <div
              style={{
                width: 4,
                height: 28,
                borderRadius: 2,
                background: GOLD,
                flexShrink: 0,
              }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: NAVY,
              }}
            >
              {title}
            </h2>
          </header>
        )}
        <div style={{ padding: 32 }}>{children}</div>
      </main>
    </div>
  );
}
