import React, { useState } from "react";
import AdminLayout from "@/client/components/admin/AdminLayout";
import AuditLogViewer from "@/client/components/admin/AuditLogViewer";

export default function AuditLogsPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  return (
    <AdminLayout title="Audit Logs">
      {/* Filters */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          gap: 16,
          alignItems: "flex-end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#64748b" }}>From</span>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
            style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#64748b" }}>To</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
            style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
          />
        </label>
      </div>

      <AuditLogViewer
        logs={[]}
        isLoading={false}
        onExport={() => alert("Export functionality — connect to tRPC router")}
      />
    </AdminLayout>
  );
}
