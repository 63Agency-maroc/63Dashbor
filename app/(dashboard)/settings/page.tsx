"use client";

import { FormEvent, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { changePassword } from "@/lib/api/auth";
import { AppToast } from "@/components/clients/AppToast";
import {
  useThemeSettings,
  type AppColor,
  type AppSidebar,
  type AppTheme,
} from "@/components/providers/ThemeProvider";

type SettingsTab =
  | "security"
  | "appearance"
  | "notifications"
  | "integrations"
  | "backup"
  | "developer";

const MIN_PASSWORD_LEN = 8;

const TABS: { id: SettingsTab; label: string; soon?: boolean }[] = [
  { id: "security", label: "Sécurité" },
  { id: "appearance", label: "Apparence" },
  { id: "notifications", label: "Notifications", soon: true },
  { id: "integrations", label: "Intégrations", soon: true },
  { id: "backup", label: "Sauvegarde", soon: true },
  { id: "developer", label: "Développeur", soon: true },
];

const COLOR_OPTIONS: { value: AppColor; label: string; swatch: string }[] = [
  { value: "blue", label: "Bleu", swatch: "#316AFF" },
  { value: "indigo", label: "Indigo", swatch: "#6610f2" },
  { value: "purple", label: "Violet", swatch: "#6f42c1" },
  { value: "pink", label: "Rose", swatch: "#d63384" },
  { value: "red", label: "Rouge", swatch: "#dc3545" },
  { value: "orange", label: "Orange", swatch: "#fd7e14" },
  { value: "yellow", label: "Jaune", swatch: "#ffc107" },
  { value: "green", label: "Vert", swatch: "#198754" },
  { value: "teal", label: "Sarcelle", swatch: "#20c997" },
  { value: "cyan", label: "Cyan", swatch: "#0dcaf0" },
];

function ComingSoonPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-5 px-3">
      <div className="avatar avatar-lg bg-secondary-subtle text-secondary rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
        <i className="fi fi-rr-time-forward scale-2x" />
      </div>
      <h5 className="mb-2">{title}</h5>
      <p className="text-muted mb-3 mx-auto" style={{ maxWidth: 420 }}>
        {description}
      </p>
      <span className="badge bg-secondary-subtle text-secondary">Bientôt disponible</span>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("security");
  const { settings, setSettings } = useThemeSettings();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "danger" | "info";
  } | null>(null);

  const sidebarMode: "full" | "mini" =
    settings.appSidebar === "mini" || settings.appSidebar === "mini-hover" ? "mini" : "full";

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwdError(null);
    if (newPassword.length < MIN_PASSWORD_LEN) {
      setPwdError(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LEN} caractères.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwdError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    if (!currentPassword) {
      setPwdError("Saisissez votre mot de passe actuel.");
      return;
    }
    setPwdBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setToast({ message: "Mot de passe modifié.", variant: "success" });
    } catch (err) {
      setPwdError(
        err instanceof ApiError
          ? err.message
          : "Impossible de changer le mot de passe. Vérifiez le mot de passe actuel.",
      );
    } finally {
      setPwdBusy(false);
    }
  }

  function setTheme(appTheme: AppTheme) {
    setSettings({ appTheme });
  }

  function setSidebar(mode: "full" | "mini") {
    setSettings({ appSidebar: mode as AppSidebar });
  }

  function setColor(appColor: AppColor) {
    setSettings({ appColor });
  }

  return (
    <div className="container-fluid">
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex flex-wrap gap-3 align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Settings
            </li>
          </ol>
        </nav>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <ul className="nav nav-underline card-header-tabs flex-wrap" role="tablist">
                {TABS.map((tab) => (
                  <li className="nav-item" key={tab.id}>
                    <button
                      type="button"
                      className={`nav-link${activeTab === tab.id ? " active" : ""}${tab.soon ? " text-muted" : ""}`}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                      {tab.soon ? (
                        <span className="badge badge-sm bg-secondary-subtle text-secondary ms-1">
                          Bientôt
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-body">
              {/* —— Sécurité —— */}
              {activeTab === "security" && (
                <div role="tabpanel">
                  <h5 className="mb-1">Sécurité / Mot de passe</h5>
                  <p className="text-muted small mb-4">
                    Changez votre mot de passe. Vous devrez saisir le mot de passe actuel.
                  </p>
                  {pwdError ? (
                    <div className="alert alert-danger" role="alert">
                      {pwdError}
                    </div>
                  ) : null}
                  <form onSubmit={handlePasswordSubmit} className="mw-100" style={{ maxWidth: 520 }}>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="settings-pwd-current">
                        Mot de passe actuel <span className="text-danger">*</span>
                      </label>
                      <input
                        id="settings-pwd-current"
                        type="password"
                        className="form-control"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        disabled={pwdBusy}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="settings-pwd-new">
                        Nouveau mot de passe <span className="text-danger">*</span>
                      </label>
                      <input
                        id="settings-pwd-new"
                        type="password"
                        className="form-control"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={MIN_PASSWORD_LEN}
                        disabled={pwdBusy}
                        autoComplete="new-password"
                      />
                      <div className="form-text">Minimum {MIN_PASSWORD_LEN} caractères</div>
                    </div>
                    <div className="mb-4">
                      <label className="form-label" htmlFor="settings-pwd-confirm">
                        Confirmer le nouveau mot de passe <span className="text-danger">*</span>
                      </label>
                      <input
                        id="settings-pwd-confirm"
                        type="password"
                        className="form-control"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        required
                        minLength={MIN_PASSWORD_LEN}
                        disabled={pwdBusy}
                        autoComplete="new-password"
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={pwdBusy}>
                      {pwdBusy ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" /> Modification…
                        </>
                      ) : (
                        "Changer le mot de passe"
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* —— Apparence —— */}
              {activeTab === "appearance" && (
                <div role="tabpanel">
                  <h5 className="mb-1">Apparence</h5>
                  <p className="text-muted small mb-4">
                    Thème, couleur d&apos;accent et sidebar — appliqués immédiatement (localStorage).
                  </p>

                  <div className="mb-4">
                    <label className="form-label fw-medium">Mode thème</label>
                    <div className="d-flex flex-wrap gap-2">
                      {(
                        [
                          { value: "light" as const, label: "Clair", icon: "fi fi-rr-sun" },
                          { value: "dark" as const, label: "Sombre", icon: "fi fi-rr-moon" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`btn ${settings.appTheme === opt.value ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setTheme(opt.value)}
                        >
                          <i className={`${opt.icon} me-1`} /> {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-medium">Sidebar (grand écran)</label>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`btn ${sidebarMode === "full" ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setSidebar("full")}
                      >
                        <i className="fi fi-rr-menu-burger me-1" /> Étendue
                      </button>
                      <button
                        type="button"
                        className={`btn ${sidebarMode === "mini" ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setSidebar("mini")}
                      >
                        <i className="fi fi-rr-apps me-1" /> Compacte
                      </button>
                    </div>
                    <div className="form-text">
                      Sur écran large (&gt;1480px) : plein panneau vs rail d&apos;icônes.
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-medium">Couleur d&apos;accent</label>
                    <div className="d-flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((c) => {
                        const active = settings.appColor === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            title={c.label}
                            aria-label={c.label}
                            aria-pressed={active}
                            className="btn p-0 border-0 bg-transparent"
                            onClick={() => setColor(c.value)}
                          >
                            <span
                              className="d-inline-flex align-items-center justify-content-center rounded-circle"
                              style={{
                                width: 36,
                                height: 36,
                                backgroundColor: c.swatch,
                                boxShadow: active
                                  ? `0 0 0 3px var(--bs-body-bg), 0 0 0 5px ${c.swatch}`
                                  : "0 0 0 1px var(--bs-border-color)",
                              }}
                            >
                              {active ? (
                                <i className="fi fi-rr-check text-white" style={{ fontSize: 14 }} />
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="form-text mt-2">
                      Accent actuel : <strong>{settings.appColor}</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <ComingSoonPanel
                  title="Notifications avancées"
                  description="Préférences email, push et SMS — bientôt branchées."
                />
              )}
              {activeTab === "integrations" && (
                <ComingSoonPanel
                  title="Intégrations"
                  description="Google Analytics, SMTP, passerelles de paiement — bientôt."
                />
              )}
              {activeTab === "backup" && (
                <ComingSoonPanel
                  title="Sauvegarde"
                  description="Backup, export de données et cache — bientôt disponibles."
                />
              )}
              {activeTab === "developer" && (
                <ComingSoonPanel
                  title="Développeur"
                  description="Mode debug, clés API et outils développeur — bientôt."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
