import React from "react";
import AdminLayout from "@/client/components/admin/AdminLayout";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#0B1F44";
const GOLD  = "#C9A84C";

const STAT_CARDS = [
  { label: "Returns in Progress",  value: "—", color: NAVY },
  { label: "Submitted This Week",  value: "—", color: "#16a34a" },
  { label: "Pending Review",       value: "—", color: "#d97706" },
  { label: "Rejected Returns",     value: "—", color: "#dc2626" },
];

export default function AdminDashboard() {
  return (
    <AdminLayout title="Dashboard">

      {/* ── Welcome banner ───────────────────────────────────────────── */}
      <div
        style={{
          background: NAVY,
          borderRadius: 12,
          padding: "20px 28px",
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 16px rgba(11,31,68,0.18)",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: GOLD }}>
            Ross Tax Pro Software
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
            IRS Authorized ERO &nbsp;·&nbsp; Tax Practitioner &nbsp;·&nbsp; Serving All 50 States
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>
            Andreaa Chan&rsquo;nel, MPA, BA
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            CEO &amp; Founder
          </div>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
          marginBottom: 32,
        }}
      >
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            style={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              padding: "20px 24px",
              borderLeft: `4px solid ${card.color}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>
              {card.value}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Recent Activity ──────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{ width: 4, height: 20, borderRadius: 2, background: GOLD }}
          />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: NAVY }}>
            Recent Activity
          </h3>
        </div>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
          Connect to your database to view recent activity.
        </p>
      </div>
    </AdminLayout>
  );
}
