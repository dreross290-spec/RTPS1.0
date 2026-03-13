"use client";

import React from "react";
import { format } from "date-fns";

export interface SubmissionStatus {
  returnId: string;
  clientName: string;
  taxYear: number;
  returnType: string;
  transmittalStatus: string | null;
  ackNumber: string | null;
  refundStatus: string | null;
  refundAmount: string | null;
  lastChecked: Date | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#92400e", bg: "#fef3c7" },
  submitted: { label: "Submitted", color: "#1e40af", bg: "#dbeafe" },
  accepted: { label: "Accepted ✓", color: "#14532d", bg: "#dcfce7" },
  rejected: { label: "Rejected ✗", color: "#7f1d1d", bg: "#fee2e2" },
  return_received: { label: "IRS Received", color: "#1e40af", bg: "#dbeafe" },
  return_approved: { label: "Approved", color: "#14532d", bg: "#dcfce7" },
  direct_deposit_sent: { label: "Deposit Sent 🏦", color: "#14532d", bg: "#d1fae5" },
  check_mailed: { label: "Check Mailed 📬", color: "#14532d", bg: "#d1fae5" },
  refund_delayed: { label: "Delayed ⚠️", color: "#92400e", bg: "#fff7ed" },
  additional_info_required: { label: "Action Needed ❗", color: "#7f1d1d", bg: "#fee2e2" },
};

interface SubmissionTrackerProps {
  submissions: SubmissionStatus[];
  isLoading?: boolean;
}

export default function SubmissionTracker({ submissions, isLoading }: SubmissionTrackerProps) {
  if (isLoading) {
    return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading submissions...</div>;
  }

  if (submissions.length === 0) {
    return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No submissions found.</div>;
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 12 }}>
        {submissions.map((sub) => {
          const statusKey = sub.refundStatus ?? sub.transmittalStatus ?? "pending";
          const statusConfig = STATUS_CONFIG[statusKey] ?? { label: statusKey, color: "#64748b", bg: "#f1f5f9" };

          return (
            <div
              key={sub.returnId}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "16px 20px",
                background: "#fff",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{sub.clientName}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {sub.returnType} · {sub.taxYear}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>ACK Number</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "#334155" }}>
                  {sub.ackNumber ?? "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Refund Amount</div>
                <div style={{ fontWeight: 600, color: "#16a34a", fontSize: 15 }}>
                  {sub.refundAmount ? `$${parseFloat(sub.refundAmount).toLocaleString()}` : "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Last Updated</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {sub.lastChecked ? format(new Date(sub.lastChecked), "MMM d, HH:mm") : "—"}
                </div>
              </div>

              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: statusConfig.color,
                  background: statusConfig.bg,
                  whiteSpace: "nowrap",
                }}
              >
                {statusConfig.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
