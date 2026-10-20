"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Flatpickr from "react-flatpickr";
import {
  getMeetings,
  getMeetingsToday,
  meetingUserDisplayName,
  MEETING_STATUSES,
  updateMeeting,
  type AssignableUser,
  type Meeting,
  type MeetingStatus,
} from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/client";
import {
  addCalendarDaysYmd,
  casablancaDayRangeUtc,
  casablancaTodayYmd,
} from "@/lib/datetime/casablanca";
import { formatDateTime } from "@/lib/datetime/timezone";
import { useViewerTimezone, useViewerTimezoneLabel } from "@/hooks/useViewerTimezone";
import { getStatusPalette } from "@/lib/calendar/statusPalette";
import { Select } from "@/components/ui/Select";

export type ListPeriod = "today" | "tomorrow" | "all" | "date";

const PAGE_SIZE = 15;

type Props = {
  canAssign: boolean;
  assignableUsers: AssignableUser[];
  /** Incrémenté après CRUD calendrier/tableau → recharge selon filtres courants */
  reloadToken: number;
  onView: (meeting: Meeting) => void;
  onEdit: (meeting: Meeting) => void;
  onMeetingChange?: (meeting: Meeting) => void;
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

function assigneeNames(m: Meeting): string {
  const fromAssignees = (m.assignees ?? [])
    .map((a) => a.prenom || a.nom || a.email || a.id)
    .filter(Boolean);
  if (fromAssignees.length) return fromAssignees.join(", ");
  return (m.assignedUserIds ?? []).join(", ") || "—";
}

function StatusBadgeControl({
  meeting,
  saving,
  onPick,
}: {
  meeting: Meeting;
  saving: boolean;
  onPick: (status: MeetingStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const palette = getStatusPalette(meeting.status);

  const placeMenu = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const openUp = window.innerHeight - rect.bottom < 280 && rect.top > 280;
    setMenuPos({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 220)),
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onWin = () => placeMenu();
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, placeMenu]);

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="dropdown-menu show shadow-sm py-1 status-menu"
            role="listbox"
            aria-label="Statut"
            style={{
              position: "fixed",
              top: menuPos.openUp ? undefined : menuPos.top,
              bottom: menuPos.openUp ? window.innerHeight - menuPos.top : undefined,
              left: menuPos.left,
              zIndex: 2000,
              minWidth: 180,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {MEETING_STATUSES.map((status) => {
              const option = getStatusPalette(status);
              const active = status === meeting.status;
              return (
                <button
                  key={status}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="dropdown-item d-flex align-items-center gap-2"
                  onClick={() => {
                    setOpen(false);
                    if (status !== meeting.status) onPick(status);
                  }}
                >
                  <span
                    className="badge rounded-pill"
                    style={{ backgroundColor: option.bg, color: option.text }}
                  >
                    {option.label}
                  </span>
                  {active ? <i className="fi fi-rr-check ms-auto text-primary" aria-hidden /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="badge rounded-pill border-0 d-inline-flex align-items-center"
        style={{ backgroundColor: palette.bg, color: palette.text, cursor: saving ? "wait" : "pointer" }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Statut : ${palette.label || meeting.status}`}
        disabled={saving}
        onClick={() => setOpen((current) => !current)}
      >
        {palette.label || meeting.status}
        <i className="fi fi-rr-angle-small-down ms-1" aria-hidden />
      </button>
      {menu}
    </>
  );
}

export function MeetingsListSection({
  canAssign,
  assignableUsers,
  reloadToken,
  onView,
  onEdit,
  onMeetingChange,
  onToast,
}: Props) {
  const viewerTimezone = useViewerTimezone();
  const viewerTzLabel = useViewerTimezoneLabel();
  const [period, setPeriod] = useState<ListPeriod>("today");
  const [preciseYmd, setPreciseYmd] = useState("");
  const [status, setStatus] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = status || undefined;
      const assigneeParam = canAssign && assignedUserId ? assignedUserId : undefined;

      let res: { items: Meeting[] };

      if (period === "today" && !statusParam && !assigneeParam) {
        res = await getMeetingsToday();
      } else if (period === "all") {
        res = await getMeetings({
          status: statusParam,
          assignedUserId: assigneeParam,
        });
      } else {
        let ymd = "";
        if (period === "today") ymd = casablancaTodayYmd();
        else if (period === "tomorrow") {
          const t = addCalendarDaysYmd(casablancaTodayYmd(), 1);
          if (!t) throw new Error("Date demain invalide");
          ymd = t;
        } else {
          ymd = preciseYmd;
          if (!ymd) {
            setItems([]);
            setLoading(false);
            return;
          }
        }
        const range = casablancaDayRangeUtc(ymd);
        if (!range) throw new Error("Période invalide");
        res = await getMeetings({
          from: range.from,
          to: range.to,
          status: statusParam,
          assignedUserId: assigneeParam,
        });
      }

      const list = Array.isArray(res.items) ? [...res.items] : [];
      list.sort((a, b) => {
        const ta = new Date(a.meetingDate).getTime();
        const tb = new Date(b.meetingDate).getTime();
        const sa = Number.isNaN(ta) ? 0 : ta;
        const sb = Number.isNaN(tb) ? 0 : tb;
        return sa - sb;
      });
      setItems(list);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError ? err.message : "Impossible de charger la liste.");
    } finally {
      setLoading(false);
    }
  }, [period, preciseYmd, status, assignedUserId, canAssign]);

  useEffect(() => {
    void loadList();
  }, [loadList, reloadToken]);

  // Reset page quand filtres changent
  useEffect(() => {
    setPage(1);
  }, [period, preciseYmd, status, assignedUserId, search, reloadToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const hay = `${m.title ?? ""} ${m.contactName ?? ""} ${m.contactPhone ?? ""} ${m.contactEmail ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rangeFrom = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(pageCount, currentPage + 2);
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }, [currentPage, pageCount]);

  function onPeriodChange(next: ListPeriod) {
    setPeriod(next);
    if (next !== "date") setPreciseYmd("");
  }

  async function changeStatus(meeting: Meeting, next: MeetingStatus) {
    if (savingId) return;
    const previous = meeting.status;
    const optimistic = { ...meeting, status: next };
    setSavingId(meeting.id);
    setItems((rows) => rows.map((row) => (row.id === meeting.id ? optimistic : row)));
    onMeetingChange?.(optimistic);
    try {
      const updated = await updateMeeting(meeting.id, { status: next });
      const merged: Meeting =
        updated && typeof updated === "object" && updated.id
          ? { ...meeting, ...updated, status: updated.status || next }
          : optimistic;
      setItems((rows) => rows.map((row) => (row.id === meeting.id ? merged : row)));
      onMeetingChange?.(merged);
      onToast?.("Statut mis à jour.", "success");
    } catch (err) {
      const reverted = { ...meeting, status: previous };
      setItems((rows) => rows.map((row) => (row.id === meeting.id ? reverted : row)));
      onMeetingChange?.(reverted);
      onToast?.(err instanceof ApiError ? err.message : "Impossible de modifier le statut.", "danger");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="cal-meetings-table">
      <div className="card">
        <div className="card-header d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-3 border-0 pb-0">
          <h6 className="card-title mb-0 flex-shrink-0">Liste des meetings</h6>
          <div className="d-flex flex-column flex-sm-row flex-sm-nowrap align-items-stretch align-items-sm-center gap-2 ms-md-auto">
            <div className="btn-group btn-group-sm flex-shrink-0" role="group" aria-label="Période">
              {(
                [
                  ["today", "Aujourd'hui"],
                  ["tomorrow", "Demain"],
                  ["all", "Tous"],
                  ["date", "Date précise"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn ${period === key ? "btn-primary" : "btn-white btn-shadow"}`}
                  onClick={() => onPeriodChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {period === "date" ? (
              <Flatpickr
                className="form-control form-control-sm"
                style={{ width: 140 }}
                value={preciseYmd || undefined}
                options={{ dateFormat: "Y-m-d", allowInput: true }}
                onChange={(_d, dateStr) => setPreciseYmd(dateStr)}
                placeholder="AAAA-MM-JJ"
              />
            ) : null}

            <Select
              size="sm"
              className="flex-shrink-0"
              style={{ width: 150 }}
              value={status}
              onChange={setStatus}
              placeholder="Tous statuts"
              options={[
                { value: "", label: "Tous statuts" },
                ...MEETING_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
              aria-label="Filtrer par statut"
            />

            {canAssign ? (
              <Select
                size="sm"
                className="flex-shrink-0"
                style={{ width: 170 }}
                value={assignedUserId}
                onChange={setAssignedUserId}
                placeholder="Tous assignés"
                searchable
                options={[
                  { value: "", label: "Tous assignés" },
                  ...assignableUsers.map((u) => ({
                    value: u.id,
                    label: u.prenom || u.nom || "Utilisateur",
                  })),
                ]}
                aria-label="Filtrer par assigné"
              />
            ) : null}

            <div className="position-relative flex-grow-1" style={{ minWidth: 140, maxWidth: 220 }}>
              <i className="fi fi-rr-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
              <input
                type="search"
                className="form-control form-control-sm ps-5 w-100"
                placeholder="Recherche…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-body px-1 pt-2 pb-2 position-relative">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="text-muted mt-3 mb-0">Chargement des meetings…</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger m-3" role="alert">
              {error}
              <button type="button" className="btn btn-sm btn-outline-danger ms-3" onClick={() => void loadList()}>
                Réessayer
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">Aucun meeting</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-sm display table-row-rounded mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Date</th>
                      <th>Titre</th>
                      <th>Contact</th>
                      <th>Statut</th>
                      <th>Créé par</th>
                      <th>Setter</th>
                      <th>Closer</th>
                      <th>Assignés</th>
                      <th>Meet</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((m) => (
                        <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => onView(m)}>
                          <td className="text-nowrap">
                            {formatDateTime(m.meetingDate, viewerTimezone)}
                            <span className="small text-muted d-block">heure {viewerTzLabel}</span>
                          </td>
                          <td>{m.title || "—"}</td>
                          <td>
                            <div>{m.contactName || "—"}</div>
                            <small className="text-muted">
                              {[m.contactPhone, m.contactEmail].filter(Boolean).join(" · ") || "—"}
                            </small>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <StatusBadgeControl
                              meeting={m}
                              saving={savingId === m.id}
                              onPick={(status) => void changeStatus(m, status)}
                            />
                          </td>
                          <td>
                            <span className="small">
                              {meetingUserDisplayName(
                                m.createdByUser ??
                                  (m.createdBy ? { userId: m.createdBy } : null),
                              )}
                            </span>
                          </td>
                          <td>
                            <span className="small">
                              {meetingUserDisplayName(
                                m.setter ?? (m.setterId ? { userId: m.setterId } : null),
                              )}
                            </span>
                          </td>
                          <td>
                            <span className="small">
                              {meetingUserDisplayName(
                                m.closer ?? (m.closerId ? { userId: m.closerId } : null),
                              )}
                            </span>
                          </td>
                          <td>
                            <span className="small">{assigneeNames(m)}</span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {m.meetLink ? (
                              <a
                                href={m.meetLink}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-subtle-primary btn-sm btn-icon"
                                title="Ouvrir Meet"
                              >
                                <i className="fi fi-rr-link" />
                              </a>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="d-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-subtle-secondary btn-sm btn-shadow btn-icon"
                                title="Voir"
                                onClick={() => onView(m)}
                              >
                                <i className="fi fi-rr-eye" />
                              </button>
                              <button
                                type="button"
                                className="btn btn-subtle-primary btn-sm btn-shadow btn-icon"
                                title="Éditer"
                                onClick={() => onEdit(m)}
                              >
                                <i className="fi fi-rr-pencil" />
                              </button>
                            </div>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between px-3 py-2 border-top">
                <small className="text-muted">
                  {rangeFrom}–{rangeTo} sur {filtered.length}
                </small>
                <div className="btn-group">
                  <button
                    type="button"
                    className="btn btn-sm btn-white btn-shadow"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Prev
                  </button>
                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm btn-shadow ${p === currentPage ? "btn-primary" : "btn-white"}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm btn-white btn-shadow"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
