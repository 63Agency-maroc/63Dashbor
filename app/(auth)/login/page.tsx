"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApiError } from "@/lib/api/client";
import { AgencyLogo, BRAND_NAME } from "@/components/brand/AgencyLogo";

/** Page login centrée — formulaire seul, sans panneau latéral. */
export default function LoginPage() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nexlink_remember_email");
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (rememberMe) {
        try {
          localStorage.setItem("nexlink_remember_email", email);
        } catch {
          /* ignore */
        }
      } else {
        try {
          localStorage.removeItem("nexlink_remember_email");
        } catch {
          /* ignore */
        }
      }
      await login(email, password, searchParams.get("next") || undefined);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Échec de la connexion.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-layout login-page-centered">
      <div className="d-flex align-items-center justify-content-center min-vh-100 px-3 py-5">
        <div className="w-100 maxw-450px">
          <div className="mb-4 text-center d-flex justify-content-center">
            <AgencyLogo variant="auto" href="/login" height={48} />
          </div>
          <div className="text-center mb-5">
            <h5 className="mb-1">Welcome to {BRAND_NAME}</h5>
            <p className="mb-0 text-muted">Sign in to access your secure admin dashboard.</p>
          </div>
          <form onSubmit={onSubmit} noValidate>
            {error ? (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            ) : null}
            <div className="mb-4">
              <label className="form-label" htmlFor="loginEmail">
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                id="loginEmail"
                placeholder="info@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="loginPassword">
                Password
              </label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control password-input"
                  id="loginPassword"
                  placeholder="********"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  id="togglePassword"
                  className={`toggle-password${showPassword ? " active" : ""}`}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <i className="close fi fi-rr-eye-crossed" aria-hidden="true" />
                  <i className="open fi fi-rr-eye" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="mb-4">
              <div className="d-flex justify-content-between">
                <div className="form-check mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="rememberMe">
                    {" "}
                    Remember Me{" "}
                  </label>
                </div>
                <a href="#" onClick={(e) => e.preventDefault()} title="Bientôt disponible">
                  Forgot Password?
                </a>
              </div>
            </div>
            <div className="mb-3">
              <button
                type="submit"
                className="btn btn-primary waves-effect waves-light w-100"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Connexion…
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
