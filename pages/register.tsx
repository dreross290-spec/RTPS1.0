/**
 * /register – Registration page
 */

import React, { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/client/hooks/useAuth";

export default function RegisterPage() {
  const { register, user, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in – redirect to dashboard
  if (!isLoading && user) {
    void router.replace("/admin/dashboard");
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, role);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Registration failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoText}>RTPS</span>
          <span style={styles.logoSub}>Tax Return Platform</span>
        </div>

        <h1 style={styles.heading}>Create your account</h1>

        {formError && (
          <div style={styles.errorBanner} role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={submitting}
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
              autoComplete="new-password"
              required
              minLength={8}
              disabled={submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="At least 8 characters"
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="confirmPassword" style={styles.label}>
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={submitting}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              disabled={submitting}
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "staff")}
              style={styles.select}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting || isLoading}
            style={{
              ...styles.submitButton,
              opacity: submitting || isLoading ? 0.7 : 1,
              cursor: submitting || isLoading ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link href="/login" style={styles.link}>
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
    background: "#f8fafc",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: 16,
  },
  card: {
    background: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "40px 40px 32px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
  },
  logo: {
    textAlign: "center",
    marginBottom: 28,
  },
  logoText: {
    display: "block",
    fontSize: 28,
    fontWeight: 800,
    color: "#2563eb",
    letterSpacing: "-0.5px",
  },
  logoSub: {
    display: "block",
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1e293b",
    marginBottom: 24,
    textAlign: "center",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#b91c1c",
    fontSize: 14,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    color: "#1e293b",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    color: "#1e293b",
    background: "#fff",
    boxSizing: "border-box",
  },
  submitButton: {
    width: "100%",
    padding: "11px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    marginTop: 8,
    transition: "opacity 0.15s",
  },
  footer: {
    textAlign: "center",
    fontSize: 14,
    color: "#64748b",
    marginTop: 20,
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 500,
  },
};
