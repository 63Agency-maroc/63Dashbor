"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { sendLeadTemplate } from "@/lib/api/leads";
import { getTemplates, type WhatsappTemplate } from "@/lib/api/whatsapp";
import {
  applyTemplatePreview,
  detectTemplateVarIndices,
} from "@/lib/whatsapp/templatePlaceholders";
import { variable1FromName } from "@/lib/whatsapp/phones";

type Props = {
  open: boolean;
  leadId: string;
  leadName?: string | null;
  onClose: () => void;
  onSent: () => void;
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

function isApproved(status: string | null | undefined) {
  return /approved/i.test(String(status ?? ""));
}

function sortTemplates(list: WhatsappTemplate[]) {
  return [...list].sort((a, b) => {
    const aOk = isApproved(a.status) ? 0 : 1;
    const bOk = isApproved(b.status) ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    return a.name.localeCompare(b.name) || a.language.localeCompare(b.language);
  });
}

function templateKey(t: WhatsappTemplate) {
  return `${t.name}||${t.language}`;
}

function shortPreview(body: string | null | undefined, max = 90) {
  const t = (body ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function LeadSendTemplateModal({
  open,
  leadId,
  leadName,
  onClose,
  onSent,
  onToast,
}: Props) {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [varValues, setVarValues] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, sending]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSearch("");
    setSelectedKey("");
    setVarValues({});
    setSendError(null);
    void getTemplates()
      .then((res) => {
        if (cancelled) return;
        setTemplates(sortTemplates(Array.isArray(res.templates) ? res.templates : []));
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Impossible de charger les templates.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selected = useMemo(
    () => templates.find((t) => templateKey(t) === selectedKey) ?? null,
    [templates, selectedKey],
  );

  const varIndices = useMemo(
    () => detectTemplateVarIndices(selected?.body),
    [selected?.body],
  );

  useEffect(() => {
    if (!selected) {
      setVarValues({});
      return;
    }
    const indices = detectTemplateVarIndices(selected.body);
    const next: Record<number, string> = {};
    const prefill1 = variable1FromName(leadName);
    for (const i of indices) {
      next[i] = i === 1 ? prefill1 : "";
    }
    setVarValues(next);
  }, [selected, leadName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const hay = `${t.name} ${t.language} ${t.status} ${t.body}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, search]);

  const preview = selected?.body
    ? applyTemplatePreview(selected.body, varValues)
    : "";

  const canSend =
    Boolean(selected && isApproved(selected.status) && leadId) &&
    varIndices.every((i) => (varValues[i] ?? "").trim().length > 0);

  async function handleSend() {
    if (!selected || !canSend || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const variables: Record<string, string> = {};
      for (const i of varIndices) {
        variables[String(i)] = (varValues[i] ?? "").trim();
      }
      await sendLeadTemplate(leadId, {
        templateName: selected.name,
        language: selected.language || undefined,
        variables: Object.keys(variables).length ? variables : undefined,
      });
      onToast?.("Template envoyé.", "success");
      onSent();
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Envoi du template impossible.";
      setSendError(msg);
      onToast?.(msg, "danger");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: "block" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-tpl-modal-title"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="lead-tpl-modal-title">
                Envoyer un template
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Fermer"
                disabled={sending}
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Chargement…</span>
                  </div>
                </div>
              ) : loadError ? (
                <div className="alert alert-danger mb-0" role="alert">
                  {loadError}
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Rechercher un template…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      disabled={sending}
                    />
                  </div>

                  <div
                    className="list-group mb-3"
                    style={{ maxHeight: 260, overflowY: "auto" }}
                    role="listbox"
                    aria-label="Templates WhatsApp"
                  >
                    {filtered.length === 0 ? (
                      <div className="list-group-item text-muted small">Aucun template.</div>
                    ) : (
                      filtered.map((t) => {
                        const key = templateKey(t);
                        const approved = isApproved(t.status);
                        const active = key === selectedKey;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="option"
                            aria-selected={active}
                            disabled={!approved || sending}
                            className={`list-group-item list-group-item-action text-start ${active ? "active" : ""}`}
                            onClick={() => setSelectedKey(key)}
                          >
                            <div className="d-flex justify-content-between align-items-start gap-2">
                              <strong className="text-truncate">{t.name}</strong>
                              <span
                                className={`badge rounded-pill flex-shrink-0 ${
                                  approved
                                    ? "bg-success-subtle text-success"
                                    : "bg-secondary-subtle text-secondary"
                                }`}
                              >
                                {t.status || "—"}
                              </span>
                            </div>
                            <div className={`small mt-1 ${active ? "opacity-75" : "text-muted"}`}>
                              {t.language ? `${t.language} · ` : ""}
                              {shortPreview(t.body)}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selected ? (
                    <div className="border rounded p-3 bg-light">
                      <div className="small text-muted mb-2">Aperçu</div>
                      <pre
                        className="small mb-3 mb-0"
                        style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
                      >
                        {preview || selected.body || "—"}
                      </pre>

                      {varIndices.length === 0 ? (
                        <p className="small text-muted mb-0 mt-2">
                          Aucune variable — template envoyé tel quel.
                        </p>
                      ) : (
                        <div className="row g-2 mt-2">
                          {varIndices.map((i) => (
                            <div key={i} className="col-md-6">
                              <label className="form-label small mb-1">{`{{${i}}}`}</label>
                              <input
                                className="form-control form-control-sm"
                                value={varValues[i] ?? ""}
                                disabled={sending}
                                onChange={(e) =>
                                  setVarValues((prev) => ({ ...prev, [i]: e.target.value }))
                                }
                                placeholder={i === 1 ? "Prénom / nom" : `Valeur {{${i}}}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted small mb-0">
                      Sélectionnez un template APPROVED pour continuer.
                    </p>
                  )}

                  {sendError ? (
                    <div className="alert alert-danger mt-3 mb-0 py-2" role="alert">
                      {sendError}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" disabled={sending} onClick={onClose}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSend || sending || loading || Boolean(loadError)}
                onClick={() => void handleSend()}
              >
                {sending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    Envoi…
                  </>
                ) : (
                  "Envoyer"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={sending ? undefined : onClose} />
    </>
  );
}
