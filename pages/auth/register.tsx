import React, { useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth, type UserRole } from "@/client/hooks/useAuth";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await register(email, password, role);
      await router.replace("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>RTPS</h1>
        <p style={styles.subtitle}>Tax Return Platform</p>
        <h2 style={styles.heading}>Create an account</h2>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={(e) => void handleSubmit(e)} style={styles.form} noValidate>
          <label style={styles.label} htmlFor="email">
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
            disabled={loading}
          />

          <label style={styles.label} htmlFor="password">
            Password
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
            disabled={loading}
          />

          <label style={styles.label} htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={styles.input}
            placeholder="••••••••"
            disabled={loading}
          />

          <label style={styles.label} htmlFor="role">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            style={styles.select}
            disabled={loading}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={styles.footerText}>
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
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  logo: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#38bdf8",
    textAlign: "center",
  },
  subtitle: {
    margin: "4px 0 24px",
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
  },
  heading: {
    margin: "0 0 24px",
    fontSize: 18,
    fontWeight: 700,
    color: "#1e293b",
    textAlign: "center",
  },
  errorBox: {
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    borderRadius: 6,
    color: "#dc2626",
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 16,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 2,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    color: "#1e293b",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    color: "#1e293b",
    background: "#fff",
    width: "100%",
    boxSizing: "border-box",
  },
  button: {
    marginTop: 8,
    padding: "11px 0",
    borderRadius: 6,
    background: "#2563eb",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    width: "100%",
  },
  footerText: {
    marginTop: 20,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 600,
  },
};
