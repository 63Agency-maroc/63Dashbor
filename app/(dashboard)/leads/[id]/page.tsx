"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  getLead,
  type ClickUpCustomField,
  type Lead,
} from "@/lib/api/leads";
import { getLeadEmail, getLeadName, getLeadPhoneDisplay } from "@/lib/leads/clickup-fields";
import { getLeadStatusPalette } from "@/lib/leads/statusPalette";
import { formatDateTime } from "@/lib/utils/date";
import { AppToast } from "@/components/clients/AppToast";
import { LeadEmailPanel } from "@/components/leads/LeadEmailPanel";
import { LeadWhatsappPanel } from "@/components/leads/LeadWhatsappPanel";

type ConvTab = "whatsapp" | "email";

function formatFieldValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatFieldValue(v)).join(", ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "").trim();
  return digits ? `tel:${digits}` : null;
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<ConvTab>("whatsapp");
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "danger" | "info";
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForbidden(false);
    void getLead(id)
      .then((res) => {
        if (!cancelled) setLead(res.item);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else if (err instanceof ApiError && err.status === 404) {
          setError("Lead introuvable.");
        } else {
          setError(err instanceof ApiError ? err.message : "Impossible de charger le lead.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const fields: ClickUpCustomField[] = lead?.clickupData?.task?.custom_fields ?? [];
  const clickupUrl = lead?.clickupData?.task?.url;
  const displayName = getLeadName(lead) || lead?.name || "Lead";
  const phone = getLeadPhoneDisplay(lead) || lead?.phone || "";
  const email = getLeadEmail(lead) || lead?.email || "";
  const phoneLink = phone ? telHref(phone) : null;
  const statusPalette = getLeadStatusPalette(lead?.status);

  return (
    <div className="container-fluid lead-detail-page">
      <style>{`
        .lead-detail-page {
          --lead-panel-min-h: min(70vh, 720px);
        }
        .lead-detail-page .lead-detail-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
          gap: 1rem;
          align-items: stretch;
        }
        @media (max-width: 991.98px) {
          .lead-detail-page .lead-detail-grid {
            grid-template-columns: 1fr;
          }
        }
        .lead-detail-page .lead-info-card,
        .lead-detail-page .lead-conv-card {
          min-height: var(--lead-panel-min-h);
        }
        .lead-detail-page .lead-conv-card .card-body {
          display: flex;
          flex-direction: column;
          min-height: var(--lead-panel-min-h);
          padding: 0;
        }
        .lead-detail-page .lead-conv-tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--bs-border-color);
          flex-shrink: 0;
        }
        .lead-detail-page .lead-conv-tabs button {
          flex: 1;
          border: 0;
          background: transparent;
          padding: 0.75rem 1rem;
          font-weight: 600;
          color: var(--bs-secondary-color);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .lead-detail-page .lead-conv-tabs button.is-active {
          color: var(--agency-gold, #1f4e79);
          border-bottom-color: var(--agency-gold, #1f4e79);
        }
        .lead-detail-page .lead-conv-body {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .lead-detail-page .lead-wa-panel {
          flex: 1 1 auto;
          min-height: 0;
        }
        .lead-detail-page .lead-wa-panel .chat-conversation {
          min-height: 280px;
          max-height: calc(var(--lead-panel-min-h) - 160px);
        }
        .lead-detail-page .lead-meta-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--bs-secondary-color);
        }
        .lead-detail-page .lead-meta-value a {
          color: inherit;
          text-decoration: none;
        }
        .lead-detail-page .lead-meta-value a:hover {
          color: var(--agency-gold, #1f4e79);
          text-decoration: underline;
        }
      `}</style>

      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex align-items-center justify-content-between flex-wrap gap-2">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <Link href="/">
                <i className="fi fi-rr-home" /> Home
              </Link>
            </li>
            <li className="breadcrumb-item">
              <Link href="/leads">Leads</Link>
            </li>
            <li className="breadcrumb-item active text-truncate" aria-current="page">
              {loading ? "…" : displayName}
            </li>
          </ol>
        </nav>
        <Link href="/leads" className="btn btn-sm btn-white btn-shadow">
          ← Retour aux leads
        </Link>
      </div>

      {forbidden ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <h5 className="mb-2">Accès non autorisé</h5>
            <p className="text-muted mb-0">Votre rôle ne permet pas de consulter ce lead.</p>
          </div>
        </div>
      ) : loading ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Chargement…</span>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <p className="text-danger mb-3">{error}</p>
            <Link href="/leads" className="btn btn-primary btn-sm">
              Retour aux leads
            </Link>
          </div>
        </div>
      ) : lead ? (
        <div className="lead-detail-grid">
          {/* LEFT — infos lead */}
          <div className="card lead-info-card">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
                <div>
                  <h4 className="mb-2">{displayName}</h4>
                  <span
                    className="badge rounded-pill"
                    style={{ backgroundColor: statusPalette.bg, color: statusPalette.text }}
                  >
                    {lead.status || "—"}
                  </span>
                </div>
                {clickupUrl ? (
                  <a
                    href={clickupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-primary"
                  >
                    Open in ClickUp
                  </a>
                ) : null}
              </div>

              <div className="row g-3 mb-4">
                <div className="col-sm-6">
                  <div className="lead-meta-label">Téléphone</div>
                  <div className="lead-meta-value fw-semibold">
                    {phoneLink ? (
                      <a href={phoneLink}>{phone}</a>
                    ) : (
                      phone || "—"
                    )}
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="lead-meta-label">Email</div>
                  <div className="lead-meta-value fw-semibold">
                    {email ? <a href={`mailto:${email}`}>{email}</a> : "—"}
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="lead-meta-label">Liste</div>
                  <div className="fw-semibold">{lead.listName || "—"}</div>
                </div>
                <div className="col-sm-6">
                  <div className="lead-meta-label">ID</div>
                  <code className="small">{lead.id}</code>
                </div>
                <div className="col-sm-6">
                  <div className="lead-meta-label">Créé</div>
                  <div className="fw-semibold">{formatDateTime(lead.createdAt)}</div>
                </div>
                <div className="col-sm-6">
                  <div className="lead-meta-label">Mis à jour</div>
                  <div className="fw-semibold">{formatDateTime(lead.updatedAt)}</div>
                </div>
              </div>

              <h6 className="mb-2">Détails</h6>
              {fields.length === 0 ? (
                <p className="text-muted mb-0">Aucun custom field.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Name</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f, i) => (
                        <tr key={f.id || `${f.name}-${i}`}>
                          <td>{f.name || "—"}</td>
                          <td className="text-break">{formatFieldValue(f.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — conversation */}
          <div className="card lead-conv-card">
            <div className="card-body">
              <div className="lead-conv-tabs" role="tablist" aria-label="Canal">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "whatsapp"}
                  className={tab === "whatsapp" ? "is-active" : ""}
                  onClick={() => setTab("whatsapp")}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "email"}
                  className={tab === "email" ? "is-active" : ""}
                  onClick={() => setTab("email")}
                >
                  Email
                </button>
              </div>

              <div className="lead-conv-body">
                {tab === "whatsapp" ? (
                  <LeadWhatsappPanel
                    leadId={id}
                    leadName={displayName}
                    onToast={(message, variant) => setToast({ message, variant })}
                  />
                ) : (
                  <LeadEmailPanel
                    leadId={id}
                    leadEmail={email}
                    onToast={(message, variant) => setToast({ message, variant })}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
