"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import {
  deleteMailAccount,
  getMailAccount,
  saveMailAccount,
  testMailAccount,
  type MailAccountTestResult,
  type SaveMailAccountBody,
} from "@/lib/api/mailAccount";

type FormState = {
  email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: boolean;
  imap_host: string;
  imap_port: string;
  imap_secure: boolean;
  username: string;
  password: string;
};

const EMPTY_FORM: FormState = {
  email: "",
  from_name: "",
  smtp_host: "smtp.titan.email",
  smtp_port: "465",
  smtp_secure: true,
  imap_host: "imap.titan.email",
  imap_port: "993",
  imap_secure: true,
  username: "",
  password: "",
};

type Props = {
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

function buildBody(form: FormState): SaveMailAccountBody {
  const email = form.email.trim();
  const body: SaveMailAccountBody = {
    email,
    from_name: form.from_name.trim(),
    smtp_host: form.smtp_host.trim(),
    smtp_port: Number(form.smtp_port),
    smtp_secure: form.smtp_secure,
    imap_host: form.imap_host.trim(),
    imap_port: Number(form.imap_port),
    imap_secure: form.imap_secure,
    username: form.username.trim() || email,
  };
  const password = form.password.trim();
  if (password) body.password = password;
  return body;
}

function ProbeLine({ label, probe }: { label: string; probe: { ok: boolean; error?: string } }) {
  return (
    <div className={`small ${probe.ok ? "text-success" : "text-danger"}`}>
      <strong>{label}</strong> {probe.ok ? "✓" : "✗"}
      {!probe.ok && probe.error ? <span className="ms-1">{probe.error}</span> : null}
    </div>
  );
}

export function MailAccountForm({ onToast }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<MailAccountTestResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const busy = testing || saving || deleting;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void getMailAccount()
      .then((res) => {
        if (cancelled) return;
        if (res.configured && res.account) {
          const a = res.account;
          setConfigured(true);
          setUsernameTouched(Boolean(a.username) && a.username !== a.email);
          setForm({
            email: a.email,
            from_name: a.from_name,
            smtp_host: a.smtp_host,
            smtp_port: String(a.smtp_port),
            smtp_secure: a.smtp_secure,
            imap_host: a.imap_host,
            imap_port: String(a.imap_port),
            imap_secure: a.imap_secure,
            username: a.username,
            password: "",
          });
        } else {
          setConfigured(false);
          setForm(EMPTY_FORM);
          setUsernameTouched(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Impossible de charger la boîte mail.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "email" && !usernameTouched) {
        next.username = String(value);
      }
      return next;
    });
  }

  function validate(): string | null {
    if (!form.email.trim()) return "L’email est requis.";
    const smtpPort = Number(form.smtp_port);
    const imapPort = Number(form.imap_port);
    if (!Number.isInteger(smtpPort) || smtpPort <= 0) return "Port SMTP invalide.";
    if (!Number.isInteger(imapPort) || imapPort <= 0) return "Port IMAP invalide.";
    if (!form.smtp_host.trim() || !form.imap_host.trim()) return "Les hôtes SMTP et IMAP sont requis.";
    return null;
  }

  async function handleTest() {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    if (!configured && !form.password.trim()) {
      setFormError("Le mot de passe est requis pour tester une nouvelle connexion.");
      return;
    }
    setFormError(null);
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testMailAccount(buildBody(form));
      setTestResult(res);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Test de connexion impossible.";
      setFormError(msg);
      onToast?.(msg, "danger");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    if (!configured && !form.password.trim()) {
      setFormError("Le mot de passe est requis pour enregistrer une nouvelle boîte.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await saveMailAccount(buildBody(form));
      setConfigured(true);
      setForm((prev) => ({ ...prev, password: "" }));
      onToast?.("Boîte mail enregistrée.", "success");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Enregistrement impossible.";
      setFormError(msg);
      onToast?.(msg, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!configured || deleting) return;
    if (!window.confirm("Déconnecter cette boîte mail ?")) return;
    setDeleting(true);
    setFormError(null);
    try {
      await deleteMailAccount();
      setConfigured(false);
      setUsernameTouched(false);
      setForm(EMPTY_FORM);
      setTestResult(null);
      onToast?.("Boîte mail déconnectée.", "success");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Déconnexion impossible.";
      setFormError(msg);
      onToast?.(msg, "danger");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement…</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h5 className="mb-1">Ma boîte mail (SMTP / IMAP)</h5>
          <p className="text-muted small mb-0">
            Envoi et réception depuis votre adresse. Le mot de passe n’est jamais réaffiché.
          </p>
        </div>
        {configured ? (
          <span className="badge bg-success-subtle text-success">Connectée</span>
        ) : (
          <span className="badge bg-secondary-subtle text-secondary">Non connectée</span>
        )}
      </div>

      {loadError ? (
        <div className="alert alert-danger" role="alert">
          {loadError}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSave(e)} style={{ maxWidth: 640 }}>
        {formError ? (
          <div className="alert alert-danger py-2" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="mail-email">
              Email <span className="text-danger">*</span>
            </label>
            <input
              id="mail-email"
              type="email"
              className="form-control"
              value={form.email}
              required
              disabled={busy}
              autoComplete="off"
              onChange={(e) => patch("email", e.target.value)}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="mail-from-name">
              Nom d’expéditeur
            </label>
            <input
              id="mail-from-name"
              className="form-control"
              value={form.from_name}
              disabled={busy}
              onChange={(e) => patch("from_name", e.target.value)}
            />
          </div>

          <div className="col-12">
            <div className="fw-medium mb-2">SMTP</div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="mail-smtp-host">
                  Hôte
                </label>
                <input
                  id="mail-smtp-host"
                  className="form-control"
                  value={form.smtp_host}
                  disabled={busy}
                  onChange={(e) => patch("smtp_host", e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="mail-smtp-port">
                  Port
                </label>
                <input
                  id="mail-smtp-port"
                  type="number"
                  className="form-control"
                  value={form.smtp_port}
                  disabled={busy}
                  onChange={(e) => patch("smtp_port", e.target.value)}
                />
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <div className="form-check form-switch mb-2">
                  <input
                    id="mail-smtp-secure"
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={form.smtp_secure}
                    disabled={busy}
                    onChange={(e) => patch("smtp_secure", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="mail-smtp-secure">
                    SSL
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="fw-medium mb-2">IMAP</div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="mail-imap-host">
                  Hôte
                </label>
                <input
                  id="mail-imap-host"
                  className="form-control"
                  value={form.imap_host}
                  disabled={busy}
                  onChange={(e) => patch("imap_host", e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="mail-imap-port">
                  Port
                </label>
                <input
                  id="mail-imap-port"
                  type="number"
                  className="form-control"
                  value={form.imap_port}
                  disabled={busy}
                  onChange={(e) => patch("imap_port", e.target.value)}
                />
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <div className="form-check form-switch mb-2">
                  <input
                    id="mail-imap-secure"
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={form.imap_secure}
                    disabled={busy}
                    onChange={(e) => patch("imap_secure", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="mail-imap-secure">
                    SSL
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label" htmlFor="mail-username">
              Nom d’utilisateur
            </label>
            <input
              id="mail-username"
              className="form-control"
              value={form.username}
              disabled={busy}
              autoComplete="off"
              onChange={(e) => {
                setUsernameTouched(true);
                patch("username", e.target.value);
              }}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="mail-password">
              Mot de passe
            </label>
            <input
              id="mail-password"
              type="password"
              className="form-control"
              value={form.password}
              placeholder={configured ? "••••••" : ""}
              disabled={busy}
              autoComplete="new-password"
              onChange={(e) => patch("password", e.target.value)}
            />
            {configured ? (
              <div className="form-text">Laissez vide pour conserver le mot de passe actuel.</div>
            ) : null}
          </div>
        </div>

        {testResult ? (
          <div className="border rounded p-2 mt-3">
            <ProbeLine label="SMTP" probe={testResult.smtp} />
            <ProbeLine label="IMAP" probe={testResult.imap} />
          </div>
        ) : null}

        <div className="d-flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            className="btn btn-outline-primary"
            disabled={busy}
            onClick={() => void handleTest()}
          >
            {testing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Test…
              </>
            ) : (
              "Tester la connexion"
            )}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </button>
          {configured ? (
            <button
              type="button"
              className="btn btn-outline-danger"
              disabled={busy}
              onClick={() => void handleDisconnect()}
            >
              {deleting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Déconnexion…
                </>
              ) : (
                "Déconnecter"
              )}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
