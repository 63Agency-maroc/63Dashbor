"use client";

import { useEffect } from "react";
import type { ClickUpCustomField, Lead } from "@/lib/api/leads";
import { getLeadEmail, getLeadName, getLeadPhoneDisplay } from "@/lib/leads/clickup-fields";
import { formatDateTime } from "@/lib/utils/date";

type Props = {
  open: boolean;
  lead: Lead | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

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

export function LeadDetailModal({ open, lead, loading, error, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fields: ClickUpCustomField[] = lead?.clickupData?.task?.custom_fields ?? [];
  const clickupUrl = lead?.clickupData?.task?.url;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{getLeadName(lead) || lead?.name || "Lead detail"}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading…</span>
                  </div>
                </div>
              ) : error ? (
                <div className="alert alert-danger mb-0" role="alert">
                  {error}
                </div>
              ) : lead ? (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <small className="text-muted d-block">Status</small>
                      <strong>{lead.status || "—"}</strong>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">List</small>
                      <strong>{lead.listName || "—"}</strong>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Phone</small>
                      <strong>{getLeadPhoneDisplay(lead) || lead.phone || "—"}</strong>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Email</small>
                      <strong>{getLeadEmail(lead) || lead.email || "—"}</strong>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Created</small>
                      <strong>{formatDateTime(lead.createdAt)}</strong>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Updated</small>
                      <strong>{formatDateTime(lead.updatedAt)}</strong>
                    </div>
                    <div className="col-12">
                      <small className="text-muted d-block">ID</small>
                      <code className="small">{lead.id}</code>
                      {/* TODO: pas d'API — créer meeting (page Meetings à venir) */}
                    </div>
                  </div>

                  {clickupUrl ? (
                    <p className="mb-3">
                      <a href={clickupUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary">
                        Open in ClickUp
                      </a>
                    </p>
                  ) : null}

                  <h6 className="mb-2">Custom fields</h6>
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
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}
