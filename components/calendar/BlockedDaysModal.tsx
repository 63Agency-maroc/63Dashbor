"use client";

import { FormEvent, useEffect, useState } from "react";
import Flatpickr from "react-flatpickr";
import {
  createBlockedDay,
  deleteBlockedDay,
  getBlockedDays,
  type BlockedDay,
} from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/client";
import { addCalendarDaysYmd, casablancaTodayYmd } from "@/lib/datetime/casablanca";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Après create/delete — pour sync calendrier */
  onChanged: () => void;
};

export function BlockedDaysModal({ open, onClose, onChanged }: Props) {
  const [ymd, setYmd] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<BlockedDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadUpcoming() {
    setLoading(true);
    setError(null);
    try {
      const from = casablancaTodayYmd();
      const to = addCalendarDaysYmd(from, 120) || from;
      const res = await getBlockedDays({ from, to });
      const list = Array.isArray(res.items) ? [...res.items] : [];
      list.sort((a, b) => a.date.localeCompare(b.date));
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les jours bloqués.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setYmd("");
    setReason("");
    setError(null);
    void loadUpcoming();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  async function handleBlock(e: FormEvent) {
    e.preventDefault();
    if (!ymd) {
      setError("Choisissez une date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createBlockedDay({ date: ymd, reason: reason.trim() || undefined });
      setYmd("");
      setReason("");
      await loadUpcoming();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de bloquer ce jour.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteBlockedDay(id);
      setItems((prev) => prev.filter((b) => b.id !== id));
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de débloquer.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Bloquer une date</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={busy} />
            </div>
            <form onSubmit={(e) => void handleBlock(e)}>
              <div className="modal-body">
                {error ? (
                  <div className="alert alert-danger py-2" role="alert">
                    {error}
                  </div>
                ) : null}

                <div className="mb-3">
                  <label className="form-label">Date</label>
                  <Flatpickr
                    className="form-control"
                    value={ymd || undefined}
                    options={{ dateFormat: "Y-m-d", allowInput: true }}
                    onChange={(_d, dateStr) => setYmd(dateStr)}
                    disabled={busy}
                    placeholder="AAAA-MM-JJ"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Raison (optionnel)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                    maxLength={500}
                  />
                </div>

                <hr className="border-dashed" />
                <h6 className="mb-2">Jours bloqués à venir</h6>
                {loading ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm text-primary" role="status" />
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-muted small mb-0">Aucun jour bloqué</p>
                ) : (
                  <div className="d-grid gap-2" style={{ maxHeight: 220, overflowY: "auto" }}>
                    {items.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-2 px-3 py-2 bg-secondary-subtle text-secondary d-flex justify-content-between align-items-center gap-2"
                      >
                        <span className="small">
                          {b.date}
                          {b.reason ? ` — ${b.reason}` : ""}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-subtle-danger btn-icon"
                          title="Débloquer"
                          disabled={busy}
                          onClick={() => void handleUnblock(b.id)}
                        >
                          <i className="fi fi-rr-trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
                  Fermer
                </button>
                <button type="submit" className="btn btn-primary ms-2" disabled={busy || !ymd}>
                  {busy ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" /> …
                    </>
                  ) : (
                    "Bloquer"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
