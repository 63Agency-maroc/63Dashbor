"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMyAvailabilities,
  upsertAvailability,
  type AvailabilityDay,
  type AvailabilitySlot,
} from "@/lib/api/availabilities";
import { ApiError } from "@/lib/api/client";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";
import {
  COUNTRY_TIMEZONES,
  DEFAULT_AVAILABILITY_TIMEZONE,
  labelForTimezone,
} from "@/lib/calendar/countryTimezones";
import { addCalendarDaysYmd, casablancaTodayYmd } from "@/lib/datetime/casablanca";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Après save — sync calendrier / bandeau */
  onChanged: () => void;
  /** Ouvre le formulaire prérempli sur cette date (YYYY-MM-DD) */
  focusDate?: string | null;
};

type SlotForm = { start: string; end: string };

function emptySlot(): SlotForm {
  return { start: "09:00", end: "12:00" };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function hmToMinutes(hm: string): number | null {
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function normalizeHm(hm: string): string | null {
  const mins = hmToMinutes(hm);
  if (mins == null) return null;
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

function validateSlots(slots: SlotForm[]): string | null {
  if (slots.length === 0) return "Ajoutez au moins un créneau.";
  const normalized: { start: number; end: number; label: string }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const startHm = normalizeHm(slots[i].start);
    const endHm = normalizeHm(slots[i].end);
    if (!startHm || !endHm) {
      return `Créneau ${i + 1} : heure invalide (HH:mm).`;
    }
    const start = hmToMinutes(startHm)!;
    const end = hmToMinutes(endHm)!;
    if (start >= end) {
      return `Créneau ${i + 1} : le début doit être avant la fin (même jour, pas de minuit).`;
    }
    normalized.push({ start, end, label: `${startHm}–${endHm}` });
  }
  normalized.sort((a, b) => a.start - b.start);
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].start < normalized[i - 1].end) {
      return `Créneaux qui se chevauchent : ${normalized[i - 1].label} et ${normalized[i].label}.`;
    }
  }
  return null;
}

function toApiSlots(slots: SlotForm[]): AvailabilitySlot[] {
  return slots
    .map((s) => ({
      start: normalizeHm(s.start)!,
      end: normalizeHm(s.end)!,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function AvailabilitiesModal({ open, onClose, onChanged, focusDate = null }: Props) {
  const [dateYmd, setDateYmd] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_AVAILABILITY_TIMEZONE);
  const [slots, setSlots] = useState<SlotForm[]>([emptySlot()]);
  const [cache, setCache] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingExisting, setEditingExisting] = useState(false);
  const appliedFocusRef = useRef<string | null>(null);

  const existingForDate = useMemo(
    () => (dateYmd ? cache.find((d) => d.date === dateYmd) ?? null : null),
    [cache, dateYmd],
  );

  const loadRange = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = casablancaTodayYmd();
      const to = addCalendarDaysYmd(from, 90) || from;
      const res = await getMyAvailabilities({ from, to });
      const items = Array.isArray(res.items) ? res.items : [];
      setCache([...items].sort((a, b) => a.date.localeCompare(b.date)));
    } catch (err) {
      setCache([]);
      setError(err instanceof ApiError ? err.message : "Impossible de charger les disponibilités.");
    } finally {
      setLoading(false);
    }
  }, []);

  function resetForm() {
    setDateYmd("");
    setTimezone(DEFAULT_AVAILABILITY_TIMEZONE);
    setSlots([emptySlot()]);
    setEditingExisting(false);
    setError(null);
    setSuccess(null);
  }

  function applyDayToForm(day: AvailabilityDay) {
    setDateYmd(day.date);
    setTimezone(day.timezone || DEFAULT_AVAILABILITY_TIMEZONE);
    setSlots(
      day.slots?.length ? day.slots.map((s) => ({ start: s.start, end: s.end })) : [emptySlot()],
    );
    setEditingExisting(true);
    setError(null);
    setSuccess(null);
  }

  function onDatePicked(ymd: string) {
    setDateYmd(ymd);
    setError(null);
    setSuccess(null);
    const hit = cache.find((d) => d.date === ymd);
    if (hit) {
      setTimezone(hit.timezone || DEFAULT_AVAILABILITY_TIMEZONE);
      setSlots(
        hit.slots?.length ? hit.slots.map((s) => ({ start: s.start, end: s.end })) : [emptySlot()],
      );
      setEditingExisting(true);
    } else {
      setTimezone(DEFAULT_AVAILABILITY_TIMEZONE);
      setSlots([emptySlot()]);
      setEditingExisting(false);
    }
  }

  useEffect(() => {
    if (!open) {
      appliedFocusRef.current = null;
      return;
    }
    resetForm();
    void loadRange();
  }, [open, loadRange]);

  // Préremplir depuis le bandeau (Modifier) — une seule fois par focusDate
  useEffect(() => {
    if (!open || !focusDate || loading) return;
    if (appliedFocusRef.current === focusDate) return;
    const hit = cache.find((d) => d.date === focusDate);
    if (hit) {
      applyDayToForm(hit);
      appliedFocusRef.current = focusDate;
    }
  }, [open, focusDate, loading, cache]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  function updateSlot(index: number, patch: Partial<SlotForm>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSuccess(null);
    if (!dateYmd) {
      setError("Choisissez une date.");
      return;
    }
    if (!timezone) {
      setError("Choisissez un pays / timezone.");
      return;
    }
    const validation = validateSlots(slots);
    if (validation) {
      setError(validation);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const saved = await upsertAvailability({
        date: dateYmd,
        timezone,
        slots: toApiSlots(slots),
      });
      setCache((prev) => {
        const without = prev.filter((d) => d.date !== saved.date);
        return [...without, saved].sort((a, b) => a.date.localeCompare(b.date));
      });
      setEditingExisting(true);
      setSuccess(editingExisting || existingForDate ? "Disponibilités mises à jour." : "Disponibilités enregistrées.");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const tzInList = COUNTRY_TIMEZONES.some((c) => c.timezone === timezone);
  const isEditMode = Boolean(editingExisting || existingForDate);

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div
          className="modal-dialog modal-dialog-centered modal-lg"
          style={{ maxHeight: "92vh", margin: "1.25rem auto" }}
        >
          <div
            className="modal-content"
            style={{ maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="modal-header flex-shrink-0">
              <h5 className="modal-title">Disponibilités</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={busy}
              />
            </div>

            <div className="modal-body" style={{ overflowY: "auto", flex: "1 1 auto" }}>
              {loading ? (
                <div className="text-center py-3">
                  <div className="spinner-border spinner-border-sm text-primary" role="status" />
                </div>
              ) : null}

              {error ? (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              ) : null}
              {success ? (
                <div className="alert alert-success py-2" role="alert">
                  {success}
                </div>
              ) : null}

              {/* FORMULAIRE créer / modifier */}
              <form id="avail-form" onSubmit={(e) => void handleSave(e)}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="mb-0">
                    {isEditMode ? "Modifier une disponibilité" : "Ajouter une disponibilité"}
                  </h6>
                  {(dateYmd || editingExisting) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-light"
                      onClick={resetForm}
                      disabled={busy}
                    >
                      Nouveau
                    </button>
                  )}
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="avail-date">
                      Date
                    </label>
                    <CasablancaDatePicker
                      id="avail-date"
                      value={dateYmd}
                      onChange={onDatePicked}
                      disabled={busy}
                      placeholder="jj/mm/aaaa"
                    />
                    {existingForDate ? (
                      <div className="form-text text-success">Édition d’un jour déjà configuré (upsert).</div>
                    ) : dateYmd ? (
                      <div className="form-text">Nouveau jour — les créneaux seront créés à l’enregistrement.</div>
                    ) : null}
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="avail-tz">
                      Pays / timezone
                    </label>
                    <select
                      id="avail-tz"
                      className="form-select"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      disabled={busy}
                      required
                    >
                      {!tzInList && timezone ? (
                        <option value={timezone}>{labelForTimezone(timezone)}</option>
                      ) : null}
                      {COUNTRY_TIMEZONES.map((c) => (
                        <option key={c.timezone} value={c.timezone}>
                          {c.country} — {c.timezone}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">Heures des créneaux = heure locale de ce pays.</div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="form-label mb-0">Créneaux</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-subtle-primary"
                    onClick={() => setSlots((p) => [...p, { start: "14:00", end: "18:00" }])}
                    disabled={busy}
                  >
                    <i className="fi fi-rr-plus me-1" /> Ajouter un créneau
                  </button>
                </div>

                {slots.map((slot, idx) => (
                  <div key={idx} className="row g-2 mb-2 align-items-end">
                    <div className="col-5">
                      <label className="form-label small text-muted mb-1">Début</label>
                      <input
                        type="time"
                        className="form-control"
                        value={slot.start}
                        onChange={(e) => updateSlot(idx, { start: e.target.value })}
                        disabled={busy}
                        required
                      />
                    </div>
                    <div className="col-5">
                      <label className="form-label small text-muted mb-1">Fin</label>
                      <input
                        type="time"
                        className="form-control"
                        value={slot.end}
                        onChange={(e) => updateSlot(idx, { end: e.target.value })}
                        disabled={busy}
                        required
                      />
                    </div>
                    <div className="col-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-subtle-danger btn-icon w-100"
                        title="Supprimer le créneau"
                        onClick={() => setSlots((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)))}
                        disabled={busy || slots.length <= 1}
                      >
                        <i className="fi fi-rr-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </form>
            </div>

            <div className="modal-footer flex-shrink-0 flex-wrap gap-2 border-top">
              <button
                type="button"
                className="btn btn-light me-auto"
                onClick={onClose}
                disabled={busy}
              >
                Fermer
              </button>
              <button
                type="submit"
                form="avail-form"
                className="btn btn-primary"
                disabled={busy || !dateYmd}
              >
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                    Enregistrement…
                  </>
                ) : isEditMode ? (
                  "Enregistrer les modifications"
                ) : (
                  "Enregistrer"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
