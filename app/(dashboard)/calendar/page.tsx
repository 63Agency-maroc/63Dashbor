"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import {
  createMeeting,
  deleteMeeting,
  formatMeetingSaveError,
  getAssignableUsers,
  getBlockedDays,
  getMeetings,
  getMeetingsStats,
  regenerateMeet,
  sendReminder,
  updateMeeting,
  type AssignableUser,
  type BlockedDay,
  type Meeting,
  type MeetingsStats,
} from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { AppToast } from "@/components/clients/AppToast";
import { MeetingDetailModal } from "@/components/calendar/MeetingDetailModal";
import { MeetingFormModal, type MeetingFormPayload } from "@/components/calendar/MeetingFormModal";
import { MeetingsListSection } from "@/components/calendar/MeetingsListSection";
import { BlockedDaysModal } from "@/components/calendar/BlockedDaysModal";
import { AvailabilitiesModal } from "@/components/calendar/AvailabilitiesModal";
import { AvailabilitiesBanner } from "@/components/calendar/AvailabilitiesBanner";
import { CalendarPageShell, type CalView } from "@/components/calendar/CalendarPageShell";
import {
  deleteAvailability,
  getMyAvailabilities,
  getUserAvailabilities,
  type AvailabilityDay,
} from "@/lib/api/availabilities";
import {
  addMinutesIso,
  effectiveCasablancaTimeZone,
  getZonedParts,
  parseIso,
  toCasablancaYmd,
  casablancaTodayYmd,
  formatDateTime,
  formatTime,
} from "@/lib/datetime/casablanca";
import { getStatusPalette } from "@/lib/calendar/statusPalette";
import {
  availabilityDisplayLegend,
  buildAvailabilityBannerRows,
  buildAvailabilityDisplaySlots,
} from "@/lib/calendar/availabilityDisplay";

const DEFAULT_DURATION_MIN = 30;
const DEFAULT_VIEW: CalView = "timeGridWeek";

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Audit Performance Marketing": { bg: "#C9A24B", border: "#C9A24B", text: "#1a1a1a" },
  "Audit Performance Marketing présentiel": { bg: "#1a1a1a", border: "#1a1a1a", text: "#ffffff" },
  "Audit Performance Marketing online": { bg: "#D4AF37", border: "#D4AF37", text: "#1a1a1a" },
  "Appel téléphonique": { bg: "#6b7280", border: "#6b7280", text: "#ffffff" },
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateClickToWall(date: Date, allDay: boolean): string {
  const p = getZonedParts(date);
  if (!p) return "";
  if (allDay) return `${p.year}-${pad2(p.month)}-${pad2(p.day)} 10:00`;
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

function closerLabel(m: Meeting): string {
  const a = m.assignees?.[0];
  if (!a) return "";
  const name = [a.prenom, a.nom].filter(Boolean).join(" ").trim();
  return name || a.email || "";
}

function meetingToEvent(m: Meeting, colorBy: "status" | "type"): EventInput {
  const palette = getStatusPalette(m.status);
  const typeColor = TYPE_COLORS[m.title];
  const colors =
    colorBy === "type" && typeColor
      ? typeColor
      : { bg: palette.bg, border: palette.border, text: palette.text };
  const duration =
    typeof m.durationMinutes === "number" && m.durationMinutes > 0
      ? m.durationMinutes
      : DEFAULT_DURATION_MIN;
  const closer = closerLabel(m);
  const title = [m.contactName || m.title, closer ? `· ${closer}` : ""].filter(Boolean).join(" ");
  return {
    id: m.id,
    title,
    start: m.meetingDate,
    end: addMinutesIso(m.meetingDate, duration) ?? undefined,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    textColor: colors.text,
    classNames: palette.classNames,
    extendedProps: { meeting: m, kind: "meeting" as const },
  };
}

function blockedToEvent(b: BlockedDay): EventInput {
  return {
    id: `blocked-${b.id}`,
    start: b.date,
    allDay: true,
    display: "background",
    backgroundColor: "rgba(148, 163, 184, 0.35)",
    extendedProps: { blockedDay: b, kind: "blocked" as const },
  };
}

export default function CalendarPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isAdmin = role === "admin";
  const isAdminWhatsapp = role === "admin_whatsapp";
  const canAssign = isAdmin || isAdminWhatsapp;
  const canManageBlocked = isAdmin;
  const canManageAvailabilities = isAdmin;

  const calendarRef = useRef<FullCalendar | null>(null);

  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState<CalView>(DEFAULT_VIEW);
  const [periodTitle, setPeriodTitle] = useState("");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [colorBy, setColorBy] = useState<"status" | "type">("status");
  const [showAvail, setShowAvail] = useState(false);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [stats, setStats] = useState<MeetingsStats | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" | "info" } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formInitial, setFormInitial] = useState<Meeting | null>(null);
  const [defaultWallDate, setDefaultWallDate] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [availFocusDate, setAvailFocusDate] = useState<string | null>(null);
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDay[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availDeletingDate, setAvailDeletingDate] = useState<string | null>(null);
  const [listReloadToken, setListReloadToken] = useState(0);

  function bumpListReload() {
    setListReloadToken((n) => n + 1);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await getMeetingsStats();
      setStats(s);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
    }
  }, []);

  const loadAssignable = useCallback(async () => {
    try {
      const users = await getAssignableUsers();
      setAssignableUsers(Array.isArray(users) ? users : []);
    } catch {
      if (!canAssign) setAssignableUsers([]);
    }
  }, [canAssign]);

  const loadAvailabilities = useCallback(
    async (users: AssignableUser[]) => {
      setAvailLoading(true);
      try {
        const today = casablancaTodayYmd();
        const from = today;
        const to = today;
        const adminIds = [
          ...new Set(
            users.filter((u) => (u.role ?? "").toLowerCase() === "admin").map((u) => String(u.id)),
          ),
        ];
        const viewerId = user?.id != null ? String(user.id) : null;
        if (isAdmin && viewerId && !adminIds.includes(viewerId)) adminIds.push(viewerId);

        if (adminIds.length === 0) {
          if (isAdmin) {
            const res = await getMyAvailabilities({ from, to });
            setAvailabilityDays((Array.isArray(res.items) ? res.items : []).filter((d) => d.date === today));
          } else setAvailabilityDays([]);
          return;
        }

        const results = await Promise.all(
          adminIds.map((id) =>
            getUserAvailabilities(id, { from, to })
              .then((res) => (Array.isArray(res.items) ? res.items : []))
              .catch(async () => {
                if (isAdmin && viewerId === id) {
                  try {
                    const mine = await getMyAvailabilities({ from, to });
                    return Array.isArray(mine.items) ? mine.items : [];
                  } catch {
                    return [] as AvailabilityDay[];
                  }
                }
                return [] as AvailabilityDay[];
              }),
          ),
        );
        const byKey = new Map<string, AvailabilityDay>();
        for (const list of results) {
          for (const day of list) {
            if (day.date === today) byKey.set(`${day.userId}:${day.date}`, day);
          }
        }
        setAvailabilityDays([...byKey.values()]);
      } catch {
        setAvailabilityDays([]);
      } finally {
        setAvailLoading(false);
      }
    },
    [isAdmin, user?.id],
  );

  const loadRange = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const fromD = parseIso(from);
      const toD = parseIso(to);
      const blockedFrom = fromD ? toCasablancaYmd(fromD) : from.slice(0, 10);
      const blockedTo = toD ? toCasablancaYmd(new Date(toD.getTime() - 1)) : to.slice(0, 10);
      const [mRes, bRes] = await Promise.all([
        getMeetings({ from, to }),
        getBlockedDays({
          from: blockedFrom || from.slice(0, 10),
          to: blockedTo || to.slice(0, 10),
        }),
      ]);
      setMeetings(Array.isArray(mRes.items) ? mRes.items : []);
      setBlockedDays(Array.isArray(bRes.items) ? bRes.items : []);
      setForbidden(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setMeetings([]);
        setBlockedDays([]);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Impossible de charger le calendrier.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadAssignable();
  }, [loadStats, loadAssignable]);

  useEffect(() => {
    if (!range) return;
    void loadRange(range.from, range.to);
  }, [range, loadRange]);

  useEffect(() => {
    void loadAvailabilities(assignableUsers);
  }, [loadAvailabilities, assignableUsers]);

  const viewerUserId = user?.id != null ? String(user.id) : null;

  const availabilityDisplaySlots = useMemo(
    () => buildAvailabilityDisplaySlots(availabilityDays, viewerUserId),
    [availabilityDays, viewerUserId],
  );

  const adminNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of assignableUsers) {
      const name = (u.prenom || "").trim() || [u.prenom, u.nom].filter(Boolean).join(" ").trim();
      if (u.id) map.set(String(u.id), name || "Admin");
    }
    if (isAdmin && viewerUserId) {
      const self =
        (typeof user?.firstName === "string" && user.firstName.trim()) ||
        (typeof user?.prenom === "string" && String(user.prenom).trim()) ||
        map.get(viewerUserId) ||
        "Admin";
      if (!map.has(viewerUserId)) map.set(viewerUserId, self);
    }
    return map;
  }, [assignableUsers, isAdmin, viewerUserId, user]);

  const availabilityBannerRows = useMemo(
    () => buildAvailabilityBannerRows(availabilityDisplaySlots, adminNameById, casablancaTodayYmd()),
    [availabilityDisplaySlots, adminNameById],
  );

  const availabilityLegend = useMemo(
    () => availabilityDisplayLegend(availabilityDays, viewerUserId),
    [availabilityDays, viewerUserId],
  );

  const filteredMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (typeFilter && m.title !== typeFilter) return false;
      if (assigneeFilter) {
        const ids = m.assignedUserIds ?? [];
        const fromAssignees = (m.assignees ?? []).map((a) => a.id);
        if (![...ids, ...fromAssignees].includes(assigneeFilter)) return false;
      }
      if (q) {
        const hay = `${m.title} ${m.contactName} ${m.contactPhone ?? ""} ${m.contactEmail ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [meetings, search, statusFilter, typeFilter, assigneeFilter]);

  const events = useMemo<EventInput[]>(
    () => [...filteredMeetings.map((m) => meetingToEvent(m, colorBy)), ...blockedDays.map(blockedToEvent)],
    [filteredMeetings, blockedDays, colorBy],
  );

  const agendaSorted = useMemo(() => {
    return [...filteredMeetings].sort(
      (a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime(),
    );
  }, [filteredMeetings]);

  function upsertMeeting(m: Meeting) {
    setMeetings((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx === -1) return [...prev, m];
      const next = [...prev];
      next[idx] = m;
      return next;
    });
    setDetailMeeting((cur) => (cur?.id === m.id ? m : cur));
  }

  function removeMeeting(id: string) {
    setMeetings((prev) => prev.filter((x) => x.id !== id));
  }

  function handleDatesSet(arg: DatesSetArg) {
    setPeriodTitle(arg.view.title);
    const from = arg.start.toISOString();
    const to = arg.end.toISOString();
    setRange((prev) => {
      if (prev?.from === from && prev?.to === to) return prev;
      return { from, to };
    });
  }

  function getApi() {
    return calendarRef.current?.getApi() ?? null;
  }

  function onPrev() {
    if (activeView === "agenda") return;
    getApi()?.prev();
  }

  function onNext() {
    if (activeView === "agenda") return;
    getApi()?.next();
  }

  function onToday() {
    if (activeView === "agenda") return;
    getApi()?.today();
  }

  function onViewChange(view: CalView) {
    setActiveView(view);
    if (view === "agenda") {
      setPeriodTitle("Agenda");
      return;
    }
    requestAnimationFrame(() => {
      const api = getApi();
      if (api) {
        api.changeView(view);
        setPeriodTitle(api.view.title);
      }
    });
  }

  function openCreate(wall?: string | null) {
    setFormMode("create");
    setFormInitial(null);
    setDefaultWallDate(wall ?? null);
    setFormError(null);
    setFormOpen(true);
    setDetailOpen(false);
  }

  function openEdit(meeting: Meeting) {
    setFormMode("edit");
    setFormInitial(meeting);
    setDefaultWallDate(null);
    setFormError(null);
    setFormOpen(true);
    setDetailOpen(false);
  }

  function openDetail(meeting: Meeting) {
    setDetailMeeting(meeting);
    setDetailError(null);
    setDetailOpen(true);
  }

  async function handleFormSubmit(payload: MeetingFormPayload) {
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        const created = await createMeeting({
          title: payload.title,
          meetingDate: payload.meetingDate,
          durationMinutes: payload.durationMinutes,
          contactName: payload.contactName,
          contactPhone: payload.contactPhone,
          contactEmail: payload.contactEmail,
          leadId: payload.leadId,
          status: payload.status,
          notes: payload.notes,
          members: payload.members,
          assignedUserIds: canAssign ? payload.assignedUserIds : undefined,
          reminders: payload.reminders,
          notifyOnCreate: payload.notifyOnCreate,
        });
        upsertMeeting(created);
        bumpListReload();
        setToast({ message: "Meeting créé.", variant: "success" });
        void loadStats();
      } else if (formInitial) {
        const updated = await updateMeeting(formInitial.id, {
          title: payload.title,
          meetingDate: payload.meetingDate,
          durationMinutes: payload.durationMinutes,
          contactName: payload.contactName,
          contactPhone: payload.contactPhone,
          contactEmail: payload.contactEmail,
          leadId: payload.leadId,
          status: payload.status,
          notes: payload.notes,
          members: payload.members,
          assignedUserIds: canAssign ? payload.assignedUserIds : formInitial.assignedUserIds,
          reminders: payload.reminders,
        });
        upsertMeeting(updated);
        bumpListReload();
        setToast({ message: "Meeting mis à jour.", variant: "success" });
        void loadStats();
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(formatMeetingSaveError(err));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!detailMeeting) return;
    setDetailBusy(true);
    setDetailError(null);
    try {
      await deleteMeeting(detailMeeting.id);
      removeMeeting(detailMeeting.id);
      bumpListReload();
      setDetailOpen(false);
      setDetailMeeting(null);
      setToast({ message: "Meeting supprimé.", variant: "info" });
      void loadStats();
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Suppression impossible.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function handleSendReminder(dto: {
    channel: "whatsapp" | "email" | "both";
    offset: "2d" | "24h" | "2h";
    force: boolean;
  }) {
    if (!detailMeeting) return;
    setDetailBusy(true);
    setDetailError(null);
    try {
      const res = await sendReminder(detailMeeting.id, dto);
      setToast({ message: res.ok ? "Rappel envoyé." : "Rappel traité.", variant: "success" });
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Envoi du rappel impossible.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function handleRegenerate() {
    if (!detailMeeting || !isAdmin) return;
    setDetailBusy(true);
    setDetailError(null);
    try {
      const updated = await regenerateMeet(detailMeeting.id);
      upsertMeeting(updated);
      bumpListReload();
      setToast({ message: "Lien Meet régénéré.", variant: "success" });
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Régénération impossible.");
    } finally {
      setDetailBusy(false);
    }
  }

  function onEventClick(arg: EventClickArg) {
    if (arg.event.extendedProps?.kind === "blocked") return;
    const meeting = arg.event.extendedProps?.meeting as Meeting | undefined;
    if (meeting) openDetail(meeting);
  }

  function onDateClick(arg: { date: Date; allDay: boolean }) {
    const wall = dateClickToWall(arg.date, arg.allDay);
    const ymd = toCasablancaYmd(arg.date);
    if (ymd && blockedDays.some((b) => b.date === ymd)) {
      setToast({ message: "Ce jour est bloqué.", variant: "info" });
      return;
    }
    openCreate(wall);
  }

  function onSelect(arg: DateSelectArg) {
    openCreate(dateClickToWall(arg.start, arg.allDay));
    arg.view.calendar.unselect();
  }

  function refreshCalendarRange() {
    if (range) void loadRange(range.from, range.to);
    void loadAvailabilities(assignableUsers);
  }

  async function handleBannerDelete(dateYmd: string) {
    if (!canManageAvailabilities) return;
    setAvailDeletingDate(dateYmd);
    try {
      await deleteAvailability(dateYmd);
      setAvailabilityDays((prev) => prev.filter((d) => d.date !== dateYmd));
      setToast({ message: "Disponibilité du jour supprimée.", variant: "success" });
      void loadAvailabilities(assignableUsers);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Suppression impossible.",
        variant: "danger",
      });
    } finally {
      setAvailDeletingDate(null);
    }
  }

  const assigneeOptions = assignableUsers.map((u) => ({
    value: u.id,
    label: [u.prenom, u.nom].filter(Boolean).join(" ") || u.email || "Utilisateur",
  }));

  const showGrid = activeView !== "agenda";

  return (
    <div className="container-fluid">
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      {forbidden ? (
        <div className="cal-page">
          <div className="cal-page__stage text-center py-5">
            <h5 className="mb-2">Accès non autorisé au calendrier</h5>
            <p className="text-muted mb-0">Votre rôle ne permet pas de consulter les meetings.</p>
          </div>
        </div>
      ) : (
        <>
          <CalendarPageShell
            periodTitle={periodTitle}
            activeView={activeView}
            stats={stats}
            meetingCount={filteredMeetings.length}
            canManageBlocked={canManageBlocked}
            canManageAvailabilities={canManageAvailabilities}
            canAssign={canAssign}
            search={search}
            assigneeFilter={assigneeFilter}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            colorBy={colorBy}
            assigneeOptions={assigneeOptions}
            onPrev={onPrev}
            onNext={onNext}
            onToday={onToday}
            onViewChange={onViewChange}
            onSearchChange={setSearch}
            onAssigneeFilter={setAssigneeFilter}
            onStatusFilter={setStatusFilter}
            onTypeFilter={setTypeFilter}
            onColorBy={setColorBy}
            onAddMeeting={() => openCreate(null)}
            onBlockDate={() => setBlockModalOpen(true)}
            onAvailabilities={() => {
              setAvailFocusDate(null);
              setAvailModalOpen(true);
            }}
          >
            {error ? (
              <div className="alert alert-danger mb-3" role="alert">
                {error}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger ms-3"
                  onClick={() => range && void loadRange(range.from, range.to)}
                >
                  Réessayer
                </button>
              </div>
            ) : null}

            {canManageAvailabilities ? (
              <div className="mb-2">
                <button
                  type="button"
                  className="cal-page__chip"
                  onClick={() => setShowAvail((v) => !v)}
                >
                  {showAvail ? "Masquer dispos" : "Voir dispos du jour"}
                </button>
              </div>
            ) : null}

            {showAvail ? (
              <AvailabilitiesBanner
                rows={availabilityBannerRows}
                legend={availabilityLegend}
                loading={availLoading}
                canManage={canManageAvailabilities}
                deletingDate={availDeletingDate}
                onEdit={(dateYmd) => {
                  setAvailFocusDate(dateYmd);
                  setAvailModalOpen(true);
                }}
                onDelete={(dateYmd) => void handleBannerDelete(dateYmd)}
              />
            ) : null}

            <div className={`cal-page__grid-wrap position-relative${showGrid ? "" : " d-none"}`}>
              {loading && showGrid ? (
                <div className="cal-page__loading">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : null}
              {mounted ? (
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView={DEFAULT_VIEW}
                  headerToolbar={false}
                  height="auto"
                  slotMinTime="08:00:00"
                  slotMaxTime="20:00:00"
                  allDaySlot={false}
                  nowIndicator
                  timeZone={effectiveCasablancaTimeZone()}
                  events={events}
                  editable={false}
                  selectable
                  selectMirror
                  dayMaxEvents={3}
                  views={{
                    timeGridThreeDay: {
                      type: "timeGrid",
                      duration: { days: 3 },
                      buttonText: "3 jours",
                    },
                  }}
                  datesSet={handleDatesSet}
                  eventClick={onEventClick}
                  dateClick={onDateClick}
                  select={onSelect}
                />
              ) : (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              )}
            </div>

            {!showGrid ? (
              <div className="cal-page__agenda-list">
                {agendaSorted.length === 0 ? (
                  <p className="text-muted text-center py-4 mb-0">Aucun rendez-vous pour cette période.</p>
                ) : (
                  agendaSorted.map((m) => {
                    const palette = getStatusPalette(m.status);
                    const closer = closerLabel(m);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="cal-page__agenda-row"
                        onClick={() => openDetail(m)}
                      >
                        <span className="cal-page__agenda-time">
                          <strong>{formatTime(m.meetingDate)}</strong>
                          <small>{formatDateTime(m.meetingDate)}</small>
                        </span>
                        <span
                          className="cal-page__agenda-dot"
                          style={{ background: palette.bg }}
                          aria-hidden
                        />
                        <span className="cal-page__agenda-body min-w-0">
                          <span className="cal-page__agenda-title text-truncate">
                            {m.contactName || m.title}
                          </span>
                          <span className="cal-page__agenda-meta text-truncate">
                            {m.title}
                            {closer ? ` · ${closer}` : " · Unassigned"}
                          </span>
                        </span>
                        <span className={`badge ${palette.badgeClass}`}>{palette.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </CalendarPageShell>

          {/* Tableau conservé en bas */}
          <div className="cal-page__table mt-3">
            <MeetingsListSection
              canAssign={canAssign}
              assignableUsers={assignableUsers}
              reloadToken={listReloadToken}
              onView={openDetail}
              onEdit={openEdit}
            />
          </div>
        </>
      )}

      <MeetingFormModal
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        defaultWallDate={defaultWallDate}
        assignableUsers={assignableUsers}
        showAssignees={canAssign}
        submitting={formSubmitting}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={(p) => void handleFormSubmit(p)}
      />

      <MeetingDetailModal
        open={detailOpen}
        meeting={detailMeeting}
        isAdmin={isAdmin}
        busy={detailBusy}
        error={detailError}
        onClose={() => setDetailOpen(false)}
        onEdit={() => detailMeeting && openEdit(detailMeeting)}
        onDelete={() => void handleDelete()}
        onSendReminder={(dto) => void handleSendReminder(dto)}
        onRegenerateMeet={() => void handleRegenerate()}
      />

      {canManageBlocked ? (
        <BlockedDaysModal
          open={blockModalOpen}
          onClose={() => setBlockModalOpen(false)}
          onChanged={() => {
            refreshCalendarRange();
            setToast({ message: "Jours bloqués mis à jour.", variant: "info" });
          }}
        />
      ) : null}

      {canManageAvailabilities ? (
        <AvailabilitiesModal
          open={availModalOpen}
          focusDate={availFocusDate}
          onClose={() => {
            setAvailModalOpen(false);
            setAvailFocusDate(null);
          }}
          onChanged={() => {
            refreshCalendarRange();
            setToast({ message: "Disponibilités mises à jour.", variant: "success" });
          }}
        />
      ) : null}
    </div>
  );
}
