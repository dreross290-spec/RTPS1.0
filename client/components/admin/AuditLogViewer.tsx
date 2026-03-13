"use client";

import React, { useState } from "react";
import { format } from "date-fns";

export interface AuditLogEntry {
  logId: string;
  accountId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string | null;
  timestamp: Date | string;
}

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  isLoading?: boolean;
  onExport?: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  create: "#16a34a",
  update: "#2563eb",
  delete: "#dc2626",
  login: "#9333ea",
  logout: "#6b7280",
  submit: "#d97706",
  compliance_warning: "#f97316",
  compliance_violation: "#dc2626",
};

export default function AuditLogViewer({ logs, isLoading, onExport }: AuditLogViewerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading audit logs...</div>;
  }

  if (logs.length === 0) {
    return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No audit logs found.</div>;
  }

  return (
    <div>
      {onExport && (
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onExport}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Export CSV
          </button>
        </div>
      )}

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Timestamp", "User", "Action", "Entity Type", "Entity ID", "IP", ""].map((h) => (
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
            {logs.map((log) => (
              <React.Fragment key={log.logId}>
                <tr
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    background: expandedId === log.logId ? "#eff6ff" : "#fff",
                  }}
                >
                  <td style={{ padding: "10px 16px", color: "#64748b" }}>
                    {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                  </td>
                  <td style={{ padding: "10px 16px" }}>{log.userId.slice(0, 12)}...</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span
                      style={{
                        background: `${ACTION_COLORS[log.action] ?? "#94a3b8"}22`,
                        color: ACTION_COLORS[log.action] ?? "#64748b",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>{log.entityType}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11 }}>
                    {log.entityId.slice(0, 12)}...
                  </td>
                  <td style={{ padding: "10px 16px", color: "#94a3b8" }}>{log.ipAddress ?? "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {log.changes && (
                      <button
                        onClick={() => setExpandedId(expandedId === log.logId ? null : log.logId)}
                        style={{
                          background: "none",
                          border: "1px solid #e2e8f0",
                          padding: "3px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        {expandedId === log.logId ? "Hide" : "Details"}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedId === log.logId && log.changes && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ padding: "12px 16px", background: "#f8fafc" }}
                    >
                      <pre
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "#334155",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
