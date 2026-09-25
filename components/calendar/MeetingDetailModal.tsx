"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import type { Meeting } from "@/lib/api/meetings";
import { formatInCasablanca, formatTime, parseIso, getZonedParts } from "@/lib/datetime/casablanca";
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
  onSendReminder: (dto: {
    channel: "whatsapp" | "email" | "both";
    offset: "2d" | "24h" | "2h";
    force: boolean;
  }) => void;
  onRegenerateMeet: () => void;
};

function assigneeLabel(a: { prenom?: string; nom?: string; email?: string; id: string }) {
  return a.prenom || a.nom || a.email || a.id;
}

function MetaTile({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="meeting-detail__tile">
      <div className="meeting-detail__tile-icon" aria-hidden>
        <i className={icon} />
      </div>
      <div className="meeting-detail__tile-body min-w-0">
        <div className="meeting-detail__tile-label">{label}</div>
        <div className="meeting-detail__tile-value">{children}</div>
      </div>
    </div>
  );
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
  const dateObj = parseIso(meeting.meetingDate);
  const parts = dateObj ? getZonedParts(dateObj) : null;
  const dateLabel = formatInCasablanca(meeting.meetingDate, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeLabel = parts
    ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
    : formatTime(meeting.meetingDate);

  const assignees = (meeting.assignees ?? []).map(assigneeLabel);
  const members = (meeting.members ?? []).map(
    (m) => m.name + (m.phone ? ` (${m.phone})` : ""),
  );

  function handleReminder(e: FormEvent) {
    e.preventDefault();
    onSendReminder({ channel, offset, force });
  }

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content meeting-detail-modal">
            <div className="meeting-detail__accent" aria-hidden />

            <div className="modal-header meeting-detail__header border-0">
              <div className="meeting-detail__hero min-w-0">
                <div className="meeting-detail__avatar" aria-hidden>
                  <i className="fi fi-rr-calendar" />
                </div>
                <div className="min-w-0">
                  <p className="meeting-detail__eyebrow mb-1">Détail du meeting</p>
                  <h5 className="modal-title mb-2" title={meeting.title}>
                    {meeting.title}
                  </h5>
                  <span className={`badge rounded-pill meeting-detail__status ${palette.badgeClass}`}>
                    {palette.label || meeting.status}
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="Fermer" onClick={onClose} disabled={busy} />
            </div>

            <div className="modal-body meeting-detail__body">
              {error ? (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              ) : null}

              <div className="meeting-detail__schedule">
                <div className="meeting-detail__schedule-main">
                  <div className="meeting-detail__schedule-icon" aria-hidden>
                    <i className="fi fi-rr-clock" />
                  </div>
                  <div>
                    <div className="meeting-detail__schedule-date">{dateLabel}</div>
                    <div className="meeting-detail__schedule-meta">
                      <span className="meeting-detail__schedule-time">{timeLabel}</span>
                      <span className="meeting-detail__schedule-tz">Africa/Casablanca</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="meeting-detail__grid">
                <MetaTile icon="fi fi-rr-user" label="Contact">
                  {meeting.contactName ? (
                    <>
                      <div>{meeting.contactName}</div>
                      {meeting.contactPhone ? (
                        <div className="meeting-detail__sub">
                          <i className="fi fi-rr-phone-call" aria-hidden /> {meeting.contactPhone}
                        </div>
                      ) : null}
                      {meeting.contactEmail ? (
                        <div className="meeting-detail__sub">
                          <i className="fi fi-rr-envelope" aria-hidden /> {meeting.contactEmail}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span className="meeting-detail__empty">Non renseigné</span>
                  )}
                </MetaTile>

                <MetaTile icon="fi fi-rr-users" label="Assignees">
                  {assignees.length > 0 ? (
                    <div className="meeting-detail__chips">
                      {assignees.map((name) => (
                        <span key={name} className="meeting-detail__chip">
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="meeting-detail__empty">Aucun</span>
                  )}
                </MetaTile>

                <MetaTile icon="fi fi-rr-user-add" label="Members">
                  {members.length > 0 ? (
                    <div className="meeting-detail__chips">
                      {members.map((name) => (
                        <span key={name} className="meeting-detail__chip">
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="meeting-detail__empty">Aucun</span>
                  )}
                </MetaTile>

                <MetaTile icon="fi fi-rr-video-camera" label="Google Meet">
                  {meeting.meetLink ? (
                    <a
                      href={meeting.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="meeting-detail__meet-btn"
                    >
                      <span className="text-truncate">Ouvrir le lien Meet</span>
                      <i className="fi fi-rr-arrow-up-right-from-square flex-shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <span className="meeting-detail__empty">Pas de lien</span>
                  )}
                </MetaTile>
              </div>

              {meeting.notes ? (
                <div className="meeting-detail__notes-block">
                  <div className="meeting-detail__notes-label">
                    <i className="fi fi-rr-document" aria-hidden /> Notes
                  </div>
                  <p className="meeting-detail__notes-text mb-0">{meeting.notes}</p>
                </div>
              ) : null}

              {showReminder ? (
                <form className="meeting-detail__panel mt-3" onSubmit={handleReminder}>
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <div className="meeting-detail__tile-icon meeting-detail__tile-icon--sm" aria-hidden>
                      <i className="fi fi-rr-bell" />
                    </div>
                    <div className="fw-semibold">Envoyer un rappel</div>
                  </div>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label">Canal</label>
                      <Select
                        size="sm"
                        value={channel}
                        onChange={(v) => setChannel(v as typeof channel)}
                        disabled={busy}
                        options={[
                          { value: "both", label: "WhatsApp + email" },
                          { value: "whatsapp", label: "WhatsApp" },
                          { value: "email", label: "Email" },
                        ]}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Délai</label>
                      <Select
                        size="sm"
                        value={offset}
                        onChange={(v) => setOffset(v as typeof offset)}
                        disabled={busy}
                        options={[
                          { value: "2d", label: "2 jours" },
                          { value: "24h", label: "24 heures" },
                          { value: "2h", label: "2 heures" },
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
                        Forcer l&apos;envoi
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

            <div className="modal-footer meeting-detail__footer border-0 flex-wrap gap-2">
              <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
                Fermer
              </button>
              <div className="meeting-detail__footer-actions d-flex flex-wrap gap-2 ms-md-auto">
                <button type="button" className="btn btn-primary" onClick={onEdit} disabled={busy}>
                  <i className="fi fi-rr-pencil me-1" aria-hidden /> Éditer
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setShowReminder(true)}
                  disabled={busy}
                >
                  <i className="fi fi-rr-bell me-1" aria-hidden /> Rappel
                </button>
                {isAdmin ? (
                  <button type="button" className="btn btn-light" onClick={onRegenerateMeet} disabled={busy}>
                    Régénérer Meet
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
