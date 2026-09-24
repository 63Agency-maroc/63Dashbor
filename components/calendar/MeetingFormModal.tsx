"use client";

import { FormEvent, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  DEFAULT_REMINDERS,
  MEETING_STATUSES,
  MEETING_TITLES,
  type AssignableUser,
  type Meeting,
  type MeetingMember,
  type MeetingReminders,
  type MeetingStatus,
} from "@/lib/api/meetings";
import { searchLeads, type Lead } from "@/lib/api/leads";
import { getLeadEmail, getLeadName, getLeadPhoneDisplay } from "@/lib/leads/clickup-fields";
import { casablancaWallToUtcIso, isoToCasablancaFlatpickr } from "@/lib/datetime/casablanca";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";

export type MeetingFormPayload = {
  title: string;
  meetingDate: string;
  durationMinutes: number;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  leadId?: string;
  status: MeetingStatus | string;
  notes?: string;
  members: MeetingMember[];
  assignedUserIds: string[];
  reminders: MeetingReminders;
  notifyOnCreate?: boolean;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Meeting | null;
  /** Prefill datetime wall Casablanca "YYYY-MM-DD HH:mm" (create from dateClick) */
  defaultWallDate?: string | null;
  assignableUsers: AssignableUser[];
  showAssignees: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: MeetingFormPayload) => void;
};

type FormState = {
  title: string;
  dateYmd: string;
  timeHm: string;
  durationMinutes: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  leadId: string;
  status: string;
  notes: string;
  members: MeetingMember[];
  assignedUserIds: string[];
  reminders: MeetingReminders;
  notifyOnCreate: boolean;
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
const DEFAULT_DURATION = 30;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Créneaux Casablanca 08:00 → 20:00, pas de 15 min */
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 20 && m > 0) break;
      slots.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h${pad2(rem)}`;
}

function normalizeDuration(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (DURATION_OPTIONS.includes(n as (typeof DURATION_OPTIONS)[number])) return n;
  return DEFAULT_DURATION;
}

function splitWallDate(wall: string | null | undefined): { dateYmd: string; timeHm: string } {
  if (!wall) return { dateYmd: "", timeHm: "" };
  const m = wall.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) {
    const ymdOnly = wall.trim().match(/^(\d{4}-\d{2}-\d{2})$/);
    if (ymdOnly) return { dateYmd: ymdOnly[1], timeHm: "" };
    return { dateYmd: "", timeHm: "" };
  }
  return { dateYmd: m[1], timeHm: `${m[2]}:${m[3]}` };
}

/** Arrondit HH:mm au créneau 15 min le plus proche (clamp 08:00–20:00 si hors plage). */
function snapToTimeSlot(hm: string): string {
  const m = hm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  let total = Number(m[1]) * 60 + Number(m[2]);
  total = Math.round(total / 15) * 15;
  const min = 8 * 60;
  const max = 20 * 60;
  if (total < min) total = min;
  if (total > max) total = max;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function timeOptionsFor(selected: string): string[] {
  if (selected && !TIME_SLOTS.includes(selected)) {
    return [...TIME_SLOTS, selected].sort();
  }
  return TIME_SLOTS;
}

const emptyMember = (): MeetingMember => ({ name: "", phone: "", email: "" });

function resolveLeadContact(lead: Lead): { contactName: string; contactPhone: string; contactEmail: string } {
  return {
    contactName: getLeadName(lead),
    contactPhone: getLeadPhoneDisplay(lead),
    contactEmail: getLeadEmail(lead),
  };
}

function cloneReminders(r?: MeetingReminders | null): MeetingReminders {
  return {
    whatsapp: {
      "2d": r?.whatsapp?.["2d"] ?? true,
      "24h": r?.whatsapp?.["24h"] ?? true,
      "2h": r?.whatsapp?.["2h"] ?? true,
    },
    email: {
      "2d": r?.email?.["2d"] ?? true,
      "24h": r?.email?.["24h"] ?? true,
      "2h": r?.email?.["2h"] ?? true,
    },
  };
}

function buildInitial(mode: "create" | "edit", initial?: Meeting | null, defaultWallDate?: string | null): FormState {
  if (mode === "edit" && initial) {
    const wall = splitWallDate(isoToCasablancaFlatpickr(initial.meetingDate));
    return {
      title: initial.title || MEETING_TITLES[0],
      dateYmd: wall.dateYmd,
      timeHm: wall.timeHm ? snapToTimeSlot(wall.timeHm) || wall.timeHm : "",
      durationMinutes: normalizeDuration(initial.durationMinutes),
      contactName: initial.contactName ?? "",
      contactPhone: initial.contactPhone ?? "",
      contactEmail: initial.contactEmail ?? "",
      leadId: initial.leadId ?? "",
      status: initial.status || "scheduled",
      notes: initial.notes ?? "",
      members: (initial.members?.length ? initial.members : []).map((m) => ({
        leadId: m.leadId,
        name: m.name ?? "",
        phone: m.phone ?? "",
        email: m.email ?? "",
      })),
      assignedUserIds: [...(initial.assignedUserIds ?? [])],
      reminders: cloneReminders(initial.reminders),
      notifyOnCreate: false,
    };
  }
  const prefill = splitWallDate(defaultWallDate);
  return {
    title: MEETING_TITLES[0],
    dateYmd: prefill.dateYmd,
    timeHm: prefill.timeHm ? snapToTimeSlot(prefill.timeHm) || prefill.timeHm : "",
    durationMinutes: DEFAULT_DURATION,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    leadId: "",
    status: "scheduled",
    notes: "",
    members: [],
    assignedUserIds: [],
    reminders: cloneReminders(DEFAULT_REMINDERS),
    notifyOnCreate: false,
  };
}

export function MeetingFormModal({
  open,
  mode,
  initial,
  defaultWallDate,
  assignableUsers,
  showAssignees,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const listboxId = useId();
  const [form, setForm] = useState<FormState>(() => buildInitial(mode, initial, defaultWallDate));
  const [localError, setLocalError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<Lead[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const suggestWrapRef = useRef<HTMLDivElement | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setForm(buildInitial(mode, initial, defaultWallDate));
    setLocalError(null);
    setSuggestions([]);
    setSuggestOpen(false);
    setHighlight(-1);
  }, [open, mode, initial, defaultWallDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        if (suggestOpen) {
          setSuggestOpen(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose, suggestOpen]);

  // Debounce recherche leads
  useEffect(() => {
    if (!open) return;
    const term = form.contactName.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      setSuggestOpen(false);
      return;
    }

    setSuggestLoading(true);
    const seq = ++searchSeq.current;
    const t = window.setTimeout(() => {
      void searchLeads(term, 8)
        .then((res) => {
          if (seq !== searchSeq.current) return;
          setSuggestions(Array.isArray(res.items) ? res.items : []);
          setSuggestOpen(true);
          setHighlight(-1);
        })
        .catch(() => {
          if (seq !== searchSeq.current) return;
          setSuggestions([]);
          setSuggestOpen(true);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSuggestLoading(false);
        });
    }, 350);

    return () => window.clearTimeout(t);
  }, [form.contactName, open]);

  useEffect(() => {
    if (!suggestOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!suggestWrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [suggestOpen]);

  const canSubmit =
    Boolean(form.title.trim()) &&
    Boolean(form.contactName.trim()) &&
    Boolean(form.dateYmd.trim()) &&
    Boolean(form.timeHm.trim()) &&
    (Boolean(form.contactPhone.trim()) || Boolean(form.contactEmail.trim())) &&
    !submitting;

  function setReminder(channel: "whatsapp" | "email", key: "2d" | "24h" | "2h", checked: boolean) {
    setForm((prev) => ({
      ...prev,
      reminders: {
        ...prev.reminders,
        [channel]: { ...prev.reminders[channel], [key]: checked },
      },
    }));
  }

  function toggleAssignee(id: string) {
    setForm((prev) => {
      const has = prev.assignedUserIds.includes(id);
      return {
        ...prev,
        assignedUserIds: has ? prev.assignedUserIds.filter((x) => x !== id) : [...prev.assignedUserIds, id],
      };
    });
  }

  function updateMember(index: number, patch: Partial<MeetingMember>) {
    setForm((prev) => {
      const members = [...prev.members];
      members[index] = { ...members[index], ...patch };
      return { ...prev, members };
    });
  }

  function onContactNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      contactName: value,
      // Invalider le lien lead si le nom change après sélection
      leadId: "",
    }));
  }

  function selectLead(lead: Lead) {
    const resolved = resolveLeadContact(lead);
    setForm((prev) => ({
      ...prev,
      contactName: resolved.contactName,
      contactPhone: resolved.contactPhone,
      contactEmail: resolved.contactEmail || prev.contactEmail,
      leadId: lead.id,
    }));
    setSuggestOpen(false);
    setSuggestions([]);
    setHighlight(-1);
  }

  function onContactKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      selectLead(suggestions[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSuggestOpen(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const contactName = form.contactName.trim();
    const contactPhone = form.contactPhone.trim();
    const contactEmail = form.contactEmail.trim();

    if (!contactName) {
      setLocalError("Le nom du contact est obligatoire.");
      return;
    }
    if (!contactPhone && !contactEmail) {
      setLocalError("Indiquez au moins un téléphone ou un email.");
      return;
    }
    if (!form.dateYmd) {
      setLocalError("La date du meeting est obligatoire.");
      return;
    }
    if (!form.timeHm) {
      setLocalError("L’heure du meeting est obligatoire.");
      return;
    }

    const meetingDate = casablancaWallToUtcIso(`${form.dateYmd} ${form.timeHm}`);
    if (!meetingDate) {
      setLocalError("Date / heure invalides (Casablanca).");
      return;
    }

    const durationMinutes = normalizeDuration(form.durationMinutes);

    const members = form.members
      .map((m) => ({
        leadId: m.leadId,
        name: (m.name ?? "").trim(),
        phone: (m.phone ?? "").trim() || undefined,
        email: (m.email ?? "").trim() || undefined,
      }))
      .filter((m) => m.name.length > 0);

    const notes = form.notes.trim();
    if (notes.length > 5000) {
      setLocalError("Notes : maximum 5000 caractères.");
      return;
    }

    const payload: MeetingFormPayload = {
      title: form.title,
      meetingDate,
      durationMinutes,
      contactName,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      leadId: form.leadId.trim() || undefined,
      status: form.status,
      notes: notes || undefined,
      members,
      assignedUserIds: showAssignees ? [...form.assignedUserIds] : [],
      reminders: cloneReminders(form.reminders),
    };
    if (mode === "create") {
      payload.notifyOnCreate = form.notifyOnCreate;
    }

    onSubmit(payload);
  }

  if (!open) return null;

  const showDropdown = suggestOpen && form.contactName.trim().length >= 2;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div
          className="modal-dialog modal-dialog-centered modal-lg"
          style={{ maxHeight: "90vh", margin: "1.75rem auto" }}
        >
          <div
            className="modal-content"
            style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="modal-header flex-shrink-0">
              <h5 className="modal-title" id="modalAddEventLabel">
                {mode === "create" ? "Ajouter un meeting" : "Modifier le meeting"}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={submitting} />
            </div>
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}
            >
              <div
                className="modal-body"
                style={{ overflowY: "auto", flex: "1 1 auto", maxHeight: "calc(80vh - 8rem)" }}
              >
                {(localError || error) && (
                  <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
                    <i className="fi fi-rr-exclamation mt-1" aria-hidden />
                    <div>
                      <div className="fw-semibold mb-0">Impossible d’enregistrer</div>
                      <div className="mb-0">{localError || error}</div>
                    </div>
                  </div>
                )}
                <div className="row">
                  <div className="col-12 mb-3">
                    <label className="form-label">Title</label>
                    <select
                      className="form-select"
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      disabled={submitting}
                      required
                    >
                      {MEETING_TITLES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4 mb-3">
                    <label className="form-label" htmlFor="meeting-date-ymd">
                      Date <span className="text-muted small">(Casablanca)</span>
                    </label>
                    <CasablancaDatePicker
                      id="meeting-date-ymd"
                      value={form.dateYmd}
                      onChange={(ymd) => setForm((p) => ({ ...p, dateYmd: ymd }))}
                      disabled={submitting}
                      placeholder="jj/mm/aaaa"
                    />
                  </div>

                  <div className="col-md-4 mb-3">
                    <label className="form-label">Heure</label>
                    <select
                      className="form-select"
                      value={form.timeHm}
                      onChange={(e) => setForm((p) => ({ ...p, timeHm: e.target.value }))}
                      disabled={submitting}
                      required
                    >
                      <option value="">Choisir…</option>
                      {timeOptionsFor(form.timeHm).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4 mb-3">
                    <label className="form-label">Durée</label>
                    <select
                      className="form-select"
                      value={form.durationMinutes}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, durationMinutes: normalizeDuration(Number(e.target.value)) }))
                      }
                      disabled={submitting}
                    >
                      {DURATION_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {durationLabel(d)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      disabled={submitting}
                    >
                      {MEETING_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 mb-3" ref={suggestWrapRef}>
                    <label className="form-label" htmlFor="meeting-contact-name">
                      Contact name <span className="text-danger">*</span>
                    </label>
                    <div className="position-relative">
                      <input
                        id="meeting-contact-name"
                        type="text"
                        className="form-control"
                        value={form.contactName}
                        onChange={(e) => onContactNameChange(e.target.value)}
                        onFocus={() => {
                          if (form.contactName.trim().length >= 2) setSuggestOpen(true);
                        }}
                        onKeyDown={onContactKeyDown}
                        role="combobox"
                        aria-expanded={showDropdown}
                        aria-controls={listboxId}
                        aria-autocomplete="list"
                        autoComplete="off"
                        placeholder="Rechercher un lead ou saisir un nom libre…"
                        required
                        disabled={submitting}
                      />
                      {suggestLoading ? (
                        <span
                          className="spinner-border spinner-border-sm text-muted position-absolute top-50 end-0 translate-middle-y me-3"
                          role="status"
                          aria-hidden
                        />
                      ) : null}
                      {form.leadId ? (
                        <span className="badge bg-success-subtle text-success position-absolute top-50 end-0 translate-middle-y me-3 me-xl-5">
                          Lead lié
                        </span>
                      ) : null}

                      {showDropdown ? (
                        <ul
                          id={listboxId}
                          role="listbox"
                          className="dropdown-menu show w-100 shadow-sm mt-1"
                          style={{ maxHeight: 240, overflowY: "auto", display: "block" }}
                        >
                          {suggestLoading && suggestions.length === 0 ? (
                            <li className="dropdown-item text-muted small disabled">Recherche…</li>
                          ) : suggestions.length === 0 ? (
                            <li className="dropdown-item text-muted small disabled">
                              Aucun lead — vous pouvez garder ce nom librement
                            </li>
                          ) : (
                            suggestions.map((lead, idx) => (
                              <li key={lead.id} role="option" aria-selected={idx === highlight}>
                                <button
                                  type="button"
                                  className={`dropdown-item${idx === highlight ? " active" : ""}`}
                                  onMouseEnter={() => setHighlight(idx)}
                                  onClick={() => selectLead(lead)}
                                >
                                  <div className="fw-medium">{getLeadName(lead) || lead.name || "—"}</div>
                                  <div className="small text-muted">
                                    {[getLeadPhoneDisplay(lead), getLeadEmail(lead)].filter(Boolean).join(" · ") ||
                                      "Pas de contact"}
                                  </div>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      ) : null}
                    </div>
                    <div className="form-text">
                      Sélectionnez un lead pour préremplir, ou saisissez un contact hors ClickUp.
                    </div>
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Contact phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.contactPhone}
                      onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Contact email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={form.contactEmail}
                      onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>

                  {showAssignees ? (
                    <div className="col-12 mb-3">
                      <label className="form-label">Assignees</label>
                      <div className="border rounded p-2" style={{ maxHeight: 140, overflowY: "auto" }}>
                        {assignableUsers.length === 0 ? (
                          <span className="text-muted small">Aucun utilisateur assignable</span>
                        ) : (
                          assignableUsers.map((u) => (
                            <label key={u.id} className="d-flex align-items-center gap-2 mb-1">
                              <input
                                type="checkbox"
                                className="form-check-input m-0"
                                checked={form.assignedUserIds.includes(u.id)}
                                onChange={() => toggleAssignee(u.id)}
                                disabled={submitting}
                              />
                              <span className="small">
                                {[u.prenom, u.nom].filter(Boolean).join(" ") || u.email}
                                {u.email ? ` · ${u.email}` : ""}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="col-12 mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label className="form-label mb-0">Members (optional)</label>
                      <button
                        type="button"
                        className="btn btn-sm btn-subtle-primary"
                        onClick={() => setForm((p) => ({ ...p, members: [...p.members, emptyMember()] }))}
                        disabled={submitting}
                      >
                        <i className="fi fi-rr-plus me-1" /> Add
                      </button>
                    </div>
                    {form.members.map((m, idx) => (
                      <div key={idx} className="row g-2 mb-2 align-items-end">
                        <div className="col-md-4">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Name"
                            value={m.name}
                            onChange={(e) => updateMember(idx, { name: e.target.value })}
                            disabled={submitting}
                          />
                        </div>
                        <div className="col-md-3">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Phone"
                            value={m.phone ?? ""}
                            onChange={(e) => updateMember(idx, { phone: e.target.value })}
                            disabled={submitting}
                          />
                        </div>
                        <div className="col-md-4">
                          <input
                            type="email"
                            className="form-control form-control-sm"
                            placeholder="Email"
                            value={m.email ?? ""}
                            onChange={(e) => updateMember(idx, { email: e.target.value })}
                            disabled={submitting}
                          />
                        </div>
                        <div className="col-md-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-subtle-danger btn-icon"
                            onClick={() =>
                              setForm((p) => ({ ...p, members: p.members.filter((_, i) => i !== idx) }))
                            }
                            disabled={submitting}
                          >
                            <i className="fi fi-rr-trash" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="col-12 mb-3">
                    <label className="form-label">Reminders</label>
                    <div className="row g-2">
                      {(["whatsapp", "email"] as const).map((channel) => (
                        <div className="col-md-6" key={channel}>
                          <div className="small text-muted text-uppercase mb-1">{channel}</div>
                          {(["2d", "24h", "2h"] as const).map((offset) => (
                            <label key={offset} className="d-inline-flex align-items-center gap-1 me-3 mb-1">
                              <input
                                type="checkbox"
                                className="form-check-input m-0"
                                checked={Boolean(form.reminders[channel]?.[offset])}
                                onChange={(e) => setReminder(channel, offset, e.target.checked)}
                                disabled={submitting}
                              />
                              <span className="small">{offset}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {mode === "create" ? (
                    <div className="col-12 mb-3">
                      <label className="d-flex align-items-center gap-2">
                        <input
                          type="checkbox"
                          className="form-check-input m-0"
                          checked={form.notifyOnCreate}
                          onChange={(e) => setForm((p) => ({ ...p, notifyOnCreate: e.target.checked }))}
                          disabled={submitting}
                        />
                        <span>Envoyer confirmation maintenant</span>
                      </label>
                    </div>
                  ) : null}

                  <div className="col-12 mb-0">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      maxLength={5000}
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer flex-shrink-0 border-top bg-body">
                <button
                  type="button"
                  className="btn btn-light waves-effect waves-light"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary waves-effect waves-light ms-2"
                  disabled={!canSubmit}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                      {mode === "create" ? "Création…" : "Enregistrement…"}
                    </>
                  ) : mode === "create" ? (
                    "Créer"
                  ) : (
                    "Enregistrer"
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
