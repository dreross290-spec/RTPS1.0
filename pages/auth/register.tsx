import React, { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/client/hooks/useAuth";

export default function RegisterPage() {
  const { register, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirm) {
      setLocalError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }
    await register(email, password, role);
  }

  const displayError = localError ?? error;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.brand}>RTPS</h1>
          <p style={styles.subtitle}>Tax Return Platform</p>
        </div>

        <h2 style={styles.title}>Create your account</h2>

        {displayError && <div style={styles.errorBanner}>{displayError}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@example.com"
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
              <span style={styles.hint}> (min 8 characters)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="confirm" style={styles.label}>
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="role" style={styles.label}>
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "staff")}
              style={styles.select}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link href="/auth/login" style={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  header: {
    textAlign: "center",
    marginBottom: 24,
  },
  brand: {
    fontSize: 28,
    fontWeight: 700,
    color: "#38bdf8",
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    margin: "4px 0 0",
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: 20,
    textAlign: "center",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    color: "#dc2626",
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 16,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: 400,
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: "#111827",
    outline: "none",
  },
  select: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: "#111827",
    background: "#fff",
    outline: "none",
  },
  submitBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "11px 0",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  footer: {
    textAlign: "center",
    fontSize: 13,
    color: "#6b7280",
    marginTop: 20,
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 500,
  },
};
