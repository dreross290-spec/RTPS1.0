import React, { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/client/hooks/useAuth";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await login(email, password);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.brand}>RTPS</h1>
          <p style={styles.subtitle}>Tax Return Platform</p>
        </div>

        <h2 style={styles.title}>Sign in to your account</h2>

        {error && <div style={styles.errorBanner}>{error}</div>}

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
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={styles.footer}>
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" style={styles.link}>
            Register
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
  input: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: "#111827",
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
