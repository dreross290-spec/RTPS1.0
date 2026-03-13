import React, { useState } from "react";
import AdminLayout from "@/client/components/admin/AdminLayout";
import SubmissionTracker from "@/client/components/transmittal/SubmissionTracker";

export default function TransmittalTrackingPage() {
  const [search, setSearch] = useState("");

  return (
    <AdminLayout title="Transmittal Tracking & Refund Status">
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by client name or ACK number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 14px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            width: 320,
          }}
        />
      </div>

      <SubmissionTracker
        submissions={[]}
        isLoading={false}
      />

      <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 16 }}>
        Connect to the tRPC transmittal.tracking router to load live data.
      </p>
    </AdminLayout>
  );
}
