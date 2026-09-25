"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Meeting } from "@/lib/api/meetings";
import { formatInCasablanca } from "@/lib/datetime/casablanca";
import { getStatusPalette } from "@/lib/calendar/statusPalette";
import { Select } from "@/components/ui/Select";

type Props = {
  open: boolean;
  meeting: Meeting | null;
  isAdmin: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendReminder: (dto: { channel: "whatsapp" | "email" | "both"; offset: "2d" | "24h" | "2h"; force: boolean }) => void;
  onRegenerateMeet: () => void;
};

function assigneeLabel(a: { prenom?: string; nom?: string; email?: string; id: string }) {
  return a.prenom || a.nom || a.email || a.id;
}

function formatRemindersStatus(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function MeetingDetailModal({
  open,
  meeting,
  isAdmin,
  busy,
  error,
  onClose,
  onEdit,
  onDelete,
  onSendReminder,
  onRegenerateMeet,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [channel, setChannel] = useState<"whatsapp" | "email" | "both">("both");
  const [offset, setOffset] = useState<"2d" | "24h" | "2h">("24h");
  const [force, setForce] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      setShowReminder(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !meeting) return null;

  const palette = getStatusPalette(meeting.status);

  function handleReminder(e: FormEvent) {
    e.preventDefault();
    onSendReminder({ channel, offset, force });
  }

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="eventTitle">
                {meeting.title}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={busy} />
            </div>
            <div className="modal-body">
              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}

              <p className="mb-2">
                <strong className="text-dark">Date:</strong>{" "}
                <span>{formatInCasablanca(meeting.meetingDate)}</span>
                <span className="text-muted small ms-1">(Casablanca)</span>
              </p>
              <p className="mb-2">
                <strong className="text-dark">Status:</strong>{" "}
                <span className={`badge ${palette.badgeClass}`}>{meeting.status}</span>
              </p>
              <p className="mb-2">
                <strong className="text-dark">Contact:</strong> {meeting.contactName || "—"}
                {meeting.contactPhone ? ` · ${meeting.contactPhone}` : ""}
                {meeting.contactEmail ? ` · ${meeting.contactEmail}` : ""}
              </p>
              <p className="mb-2">
                <strong className="text-dark">Assignees:</strong>{" "}
                {(meeting.assignees ?? []).length
                  ? (meeting.assignees ?? []).map(assigneeLabel).join(", ")
                  : "—"}
              </p>
              <p className="mb-2">
                <strong className="text-dark">Members:</strong>{" "}
                {(meeting.members ?? []).length
                  ? (meeting.members ?? [])
                      .map((m) => m.name + (m.phone ? ` (${m.phone})` : ""))
                      .join(", ")
                  : "—"}
              </p>
              <p className="mb-2">
                <strong className="text-dark">Meet link:</strong>{" "}
                {meeting.meetLink ? (
                  <a href={meeting.meetLink} target="_blank" rel="noreferrer">
                    {meeting.meetLink}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p className="mb-2">
                <strong className="text-dark">Notes:</strong> {meeting.notes || "—"}
              </p>
              <div className="mb-0">
                <strong className="text-dark">Reminders status:</strong>
                <pre className="small bg-light rounded p-2 mt-1 mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {formatRemindersStatus(meeting.remindersStatus)}
                </pre>
              </div>

              {showReminder ? (
                <form className="border rounded p-3 mt-3" onSubmit={handleReminder}>
                  <h6 className="mb-3">Envoyer un rappel</h6>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label">Channel</label>
                      <Select
                        size="sm"
                        value={channel}
                        onChange={(v) => setChannel(v as typeof channel)}
                        disabled={busy}
                        options={[
                          { value: "both", label: "both" },
                          { value: "whatsapp", label: "whatsapp" },
                          { value: "email", label: "email" },
                        ]}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Offset</label>
                      <Select
                        size="sm"
                        value={offset}
                        onChange={(v) => setOffset(v as typeof offset)}
                        disabled={busy}
                        options={[
                          { value: "2d", label: "2d" },
                          { value: "24h", label: "24h" },
                          { value: "2h", label: "2h" },
                        ]}
                      />
                    </div>
                    <div className="col-md-4 d-flex align-items-end">
                      <label className="d-flex align-items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input m-0"
                          checked={force}
                          onChange={(e) => setForce(e.target.checked)}
                          disabled={busy}
                        />
                        Force
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 d-flex gap-2">
                    <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
                      Envoyer
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-light"
                      onClick={() => setShowReminder(false)}
                      disabled={busy}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : null}

              {confirmDelete ? (
                <div className="alert alert-warning mt-3 mb-0 d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <span>Supprimer ce meeting ?</span>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-danger" onClick={onDelete} disabled={busy}>
                      Confirmer
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-light"
                      onClick={() => setConfirmDelete(false)}
                      disabled={busy}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="modal-footer flex-wrap gap-2">
              <button type="button" className="btn btn-light waves-effect waves-light" onClick={onClose} disabled={busy}>
                Close
              </button>
              <button type="button" className="btn btn-subtle-primary" onClick={onEdit} disabled={busy}>
                Éditer
              </button>
              <button type="button" className="btn btn-subtle-info" onClick={() => setShowReminder(true)} disabled={busy}>
                Envoyer rappel
              </button>
              {isAdmin ? (
                <button type="button" className="btn btn-subtle-secondary" onClick={onRegenerateMeet} disabled={busy}>
                  Régénérer Meet
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-subtle-danger"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
