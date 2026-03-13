"use client";

import React, { useState } from "react";
import { format } from "date-fns";

export interface ACKEntry {
  transmittalId: string;
  returnId: string;
  transmittalType: string;
  status: string;
  ackDate?: Date | string | null;
  errorDetails?: Record<string, unknown> | null;
  createdAt: Date | string;
}

interface ACKViewerProps {
  ackEntries: ACKEntry[];
  isLoading?: boolean;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  submitted: { color: "#1e40af", bg: "#dbeafe" },
  accepted: { color: "#14532d", bg: "#dcfce7" },
  accepted_with_errors: { color: "#92400e", bg: "#fef3c7" },
  rejected: { color: "#7f1d1d", bg: "#fee2e2" },
};

export default function ACKViewer({ ackEntries, isLoading }: ACKViewerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading ACKs...</div>;
  }

  if (ackEntries.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
        No acknowledgment records found.
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["Return ID", "Type", "Status", "ACK Date", "Submitted", ""].map((h) => (
              <th
                key={h}
                style={{
                  padding: "10px 16px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "#475569",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ackEntries.map((entry) => {
            const style = STATUS_STYLES[entry.status] ?? { color: "#64748b", bg: "#f1f5f9" };
            return (
              <React.Fragment key={entry.transmittalId}>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11 }}>
                    {entry.returnId.slice(0, 16)}...
                  </td>
                  <td style={{ padding: "10px 16px" }}>{entry.transmittalType}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        color: style.color,
                        background: style.bg,
                      }}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", color: "#64748b" }}>
                    {entry.ackDate ? format(new Date(entry.ackDate), "MMM d, yyyy HH:mm") : "—"}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#94a3b8" }}>
                    {format(new Date(entry.createdAt), "MMM d, yyyy")}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    {entry.errorDetails && (
                      <button
                        onClick={() =>
                          setExpanded(expanded === entry.transmittalId ? null : entry.transmittalId)
                        }
                        style={{
                          background: "#fee2e2",
                          border: "none",
                          padding: "3px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                          color: "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        Errors
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === entry.transmittalId && entry.errorDetails && (
                  <tr>
                    <td colSpan={6} style={{ padding: "12px 16px", background: "#fff5f5" }}>
                      <strong style={{ color: "#b91c1c", fontSize: 12 }}>Error Details:</strong>
                      <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#7f1d1d" }}>
                        {JSON.stringify(entry.errorDetails, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
