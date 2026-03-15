import React from "react";
import AdminLayout from "@/client/components/admin/AdminLayout";

const STAT_CARDS = [
  { label: "Returns in Progress", value: "—", color: "#2563eb" },
  { label: "Submitted This Week", value: "—", color: "#16a34a" },
  { label: "Pending Review", value: "—", color: "#d97706" },
  { label: "Rejected Returns", value: "—", color: "#dc2626" },
];

export default function AdminDashboard() {
  return (
    <AdminLayout title="Dashboard">
      {/* Stats */}
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
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              borderLeft: `4px solid ${card.color}`,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>
              {card.value}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity placeholder */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#1e293b" }}>
          Recent Activity
        </h3>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
          Connect to your database to view recent activity.
        </p>
      </div>
    </AdminLayout>
  );
}
