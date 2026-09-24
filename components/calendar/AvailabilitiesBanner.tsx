"use client";

import { useState } from "react";
import type { BannerAvailRow } from "@/lib/calendar/availabilityDisplay";

type Props = {
  rows: BannerAvailRow[];
  legend: string | null;
  loading?: boolean;
  /** Admin propriétaire : boutons Modifier / Supprimer */
  canManage: boolean;
  onEdit: (dateYmd: string) => void;
  onDelete: (dateYmd: string) => void;
  deletingDate?: string | null;
};

export function AvailabilitiesBanner({
  rows,
  legend,
  loading = false,
  canManage,
  onEdit,
  onDelete,
  deletingDate = null,
}: Props) {
  const [confirmDate, setConfirmDate] = useState<string | null>(null);
  const confirmRow = confirmDate ? rows.find((r) => r.date === confirmDate) : null;

  return (
    <div className="card mb-3 border-0 shadow-none" style={{ background: "rgba(220, 252, 231, 0.45)" }}>
      <div className="card-body py-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <span
              className="rounded-circle d-inline-block"
              style={{ width: 8, height: 8, backgroundColor: "#22c55e" }}
              aria-hidden
            />
            Disponibilité du jour
          </h6>
          {legend ? <span className="small text-muted">{legend}</span> : null}
        </div>

        {loading ? (
          <div className="text-muted small">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Chargement…
          </div>
        ) : rows.length === 0 ? (
          <p className="mb-0 small text-muted">Aucune disponibilité aujourd&apos;hui</p>
        ) : (
          <div className="d-flex flex-column gap-2">
            <div className="d-flex flex-wrap gap-2">
              {rows.map((row) => {
                const deleting = deletingDate === row.date;
                return (
                  <div
                    key={`${row.userId}-${row.date}`}
                    className="d-inline-flex align-items-center gap-1 flex-wrap border border-success-subtle rounded-pill px-2 py-1"
                    style={{ background: "#dcfce7", maxWidth: "100%" }}
                    title={row.title}
                  >
                    <span
                      className="small fw-semibold text-success-emphasis text-truncate"
                      style={{ maxWidth: canManage ? 280 : 360 }}
                    >
                      {row.text}
                    </span>
                    {canManage ? (
                      <span className="d-inline-flex gap-1 ms-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-success p-0 px-1"
                          style={{ fontSize: "0.75rem", textDecoration: "none" }}
                          disabled={Boolean(deletingDate)}
                          onClick={() => {
                            setConfirmDate(null);
                            onEdit(row.date);
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-0 px-1"
                          style={{ fontSize: "0.75rem", textDecoration: "none" }}
                          disabled={Boolean(deletingDate)}
                          onClick={() => setConfirmDate(row.date)}
                        >
                          {deleting ? (
                            <span className="spinner-border spinner-border-sm" role="status" />
                          ) : (
                            "Supprimer"
                          )}
                        </button>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {confirmRow ? (
              <div className="alert alert-warning mb-0 py-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <span className="small mb-0">
                  Supprimer la disponibilité du jour&nbsp;?{" "}
                  <strong>{confirmRow.text.replace(/^🟢\s*/, "")}</strong>
                </span>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={Boolean(deletingDate)}
                    onClick={() => {
                      const d = confirmRow.date;
                      setConfirmDate(null);
                      onDelete(d);
                    }}
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-light"
                    disabled={Boolean(deletingDate)}
                    onClick={() => setConfirmDate(null)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
