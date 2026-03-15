import React from "react";
import AdminLayout from "@/client/components/admin/AdminLayout";
import ACKViewer from "@/client/components/transmittal/ACKViewer";

export default function ACKMonitorPage() {
  return (
    <AdminLayout title="IRS Acknowledgment Monitor">
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 20,
          fontSize: 13,
          color: "#1e40af",
        }}
      >
        ℹ️ ACKs are automatically polled from the IRS FIRE system every 15 minutes.
      </div>

      <ACKViewer
        ackEntries={[]}
        isLoading={false}
      />

      <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 16 }}>
        Connect to the tRPC transmittal.tracking router to load live ACK data.
      </p>
    </AdminLayout>
  );
}
