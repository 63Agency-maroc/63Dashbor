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
import { CalendarActionButtons } from "@/components/calendar/CalendarActionButtons";
import { BlockedDaysModal } from "@/components/calendar/BlockedDaysModal";
import { AvailabilitiesModal } from "@/components/calendar/AvailabilitiesModal";
import { AvailabilitiesBanner } from "@/components/calendar/AvailabilitiesBanner";
import { StatCard } from "@/components/ui/StatCard";
import {
  deleteAvailability,
  getMyAvailabilities,
  getUserAvailabilities,
  type AvailabilityDay,
} from "@/lib/api/availabilities";
import {
  addMinutesIso,
  CASABLANCA_TZ,
  getZonedParts,
  parseIso,
  toCasablancaYmd,
  casablancaTodayYmd,
} from "@/lib/datetime/casablanca";
import { getStatusPalette } from "@/lib/calendar/statusPalette";
import {
  availabilityDisplayLegend,
  buildAvailabilityBannerRows,
  buildAvailabilityDisplaySlots,
} from "@/lib/calendar/availabilityDisplay";

const DEFAULT_DURATION_MIN = 30;

function meetingToEvent(m: Meeting): EventInput {
  const palette = getStatusPalette(m.status);
  const start = m.meetingDate;
  const duration =
    typeof m.durationMinutes === "number" && m.durationMinutes > 0
      ? m.durationMinutes
      : DEFAULT_DURATION_MIN;
  const end = addMinutesIso(start, duration) ?? undefined;
  return {
    id: m.id,
    title: `${m.title}${m.contactName ? ` — ${m.contactName}` : ""}`,
    start,
    end,
    backgroundColor: palette.bg,
    borderColor: palette.border,
    textColor: palette.text,
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
    backgroundColor: "rgba(148, 163, 184, 0.4)",
    extendedProps: { blockedDay: b, kind: "blocked" as const },
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateClickToWall(date: Date, allDay: boolean): string {
  const p = getZonedParts(date);
  if (!p) return "";
  if (allDay) {
    return `${p.year}-${pad2(p.month)}-${pad2(p.day)} 10:00`;
  }
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
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
      /* fixed_meeting peut ne pas y avoir accès — ok */
      if (!canAssign) setAssignableUsers([]);
    }
  }, [canAssign]);

  const loadAvailabilities = useCallback(
    async (users: AssignableUser[]) => {
      setAvailLoading(true);
      try {
        // Bandeau = dispo du jour (Casablanca), indépendant de la vue calendrier
        const today = casablancaTodayYmd();
        const from = today;
        const to = today;

        const adminIds = [
          ...new Set(
            users.filter((u) => (u.role ?? "").toLowerCase() === "admin").map((u) => String(u.id)),
          ),
        ];
        const viewerId = user?.id != null ? String(user.id) : null;
        if (isAdmin && viewerId && !adminIds.includes(viewerId)) {
          adminIds.push(viewerId);
        }

        if (adminIds.length === 0) {
          if (isAdmin) {
            const res = await getMyAvailabilities({ from, to });
            const items = Array.isArray(res.items) ? res.items : [];
            setAvailabilityDays(items.filter((d) => d.date === today));
          } else {
            setAvailabilityDays([]);
          }
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

  const loadRange = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      setError(null);
      try {
        const fromD = parseIso(from);
        const toD = parseIso(to);
        // FullCalendar `end` est exclusif → -1 ms pour la borne to YYYY-MM-DD
        const blockedFrom = fromD ? toCasablancaYmd(fromD) : from.slice(0, 10);
        const blockedTo = toD
          ? toCasablancaYmd(new Date(toD.getTime() - 1))
          : to.slice(0, 10);

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
    },
    [],
  );

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
        (typeof user?.name === "string" && user.name.trim().split(/\s+/)[0]) ||
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

  // Temps réel meeting:* — backend n'émet peut-être pas encore
  useEffect(() => {
    // TODO: pas d'API socket meeting:* pour l'instant
  }, []);

  const events = useMemo<EventInput[]>(() => {
    return [...meetings.map(meetingToEvent), ...blockedDays.map(blockedToEvent)];
  }, [meetings, blockedDays]);

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
    const from = arg.start.toISOString();
    const to = arg.end.toISOString();
    setRange((prev) => {
      if (prev?.from === from && prev?.to === to) return prev;
      return { from, to };
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
        // PATCH replace : renvoyer members / assignees / reminders COMPLETS
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
      // 409 indispo / jour bloqué et autres : garder le modal ouvert pour correction
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
      setToast({
        message: res.ok ? "Rappel envoyé." : "Rappel traité.",
        variant: "success",
      });
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
    const kind = arg.event.extendedProps?.kind;
    if (kind === "blocked") return;
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
    const wall = dateClickToWall(arg.start, arg.allDay);
    openCreate(wall);
    arg.view.calendar.unselect();
  }

  function refreshCalendarRange() {
    if (range) void loadRange(range.from, range.to);
    void loadAvailabilities(assignableUsers);
  }

  function openAvailModal(focusDate: string | null = null) {
    setAvailFocusDate(focusDate);
    setAvailModalOpen(true);
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

  const actionButtons = (
    <CalendarActionButtons
      canManageBlocked={canManageBlocked}
      canManageAvailabilities={canManageAvailabilities}
      onAddMeeting={() => openCreate(null)}
      onBlockDate={() => setBlockModalOpen(true)}
      onAvailabilities={() => openAvailModal(null)}
    />
  );

  return (
    <div className="container-fluid">
      <style>{`.fc-event-cancelled .fc-event-title{text-decoration:line-through;opacity:.75}`}</style>
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex flex-wrap align-items-center justify-content-between gap-2">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Calendar
            </li>
          </ol>
        </nav>
        {actionButtons}
      </div>

      {forbidden ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="avatar avatar-lg bg-warning-subtle text-warning rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
              <i className="fi fi-rr-lock scale-2x" />
            </div>
            <h5 className="mb-2">Accès non autorisé au calendrier</h5>
            <p className="text-muted mb-0">Votre rôle ne permet pas de consulter les meetings.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="row">
            <div className="col-12 col-md-6 col-lg-3 mb-3">
              <StatCard
                label="Today"
                value={stats?.today ?? "—"}
                subtext="Meetings"
                iconColor="primary"
                icon={<i className="icon-calendar" />}
              />
            </div>
            <div className="col-12 col-md-6 col-lg-3 mb-3">
              <StatCard
                label="This week"
                value={stats?.thisWeek ?? "—"}
                subtext="Meetings"
                iconColor="success"
                icon={<i className="icon-calendar-days" />}
              />
            </div>
            <div className="col-12 col-md-6 col-lg-3 mb-3">
              <StatCard
                label="Pending"
                value={stats?.pending ?? "—"}
                subtext="À traiter"
                iconColor="warning"
                icon={<i className="icon-hourglass" />}
              />
            </div>
            <div className="col-12 col-md-6 col-lg-3 mb-3">
              <StatCard
                label="No show"
                value={stats?.noShow ?? "—"}
                subtext="Absents"
                iconColor="danger"
                icon={<i className="icon-user-x" />}
              />
            </div>
          </div>

          {error ? (
            <div className="alert alert-danger" role="alert">
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

          <div className="d-flex flex-wrap align-items-center justify-content-end gap-2 mb-3">
            {actionButtons}
          </div>

          <AvailabilitiesBanner
            rows={availabilityBannerRows}
            legend={availabilityLegend}
            loading={availLoading}
            canManage={canManageAvailabilities}
            deletingDate={availDeletingDate}
            onEdit={(dateYmd) => openAvailModal(dateYmd)}
            onDelete={(dateYmd) => void handleBannerDelete(dateYmd)}
          />

          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-body p-4 position-relative">
                  {loading ? (
                    <div
                      className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                      style={{ background: "rgba(255,255,255,0.45)", zIndex: 2 }}
                    >
                      <div className="spinner-border text-primary" role="status" />
                    </div>
                  ) : null}

                  {mounted ? (
                    <FullCalendar
                      ref={calendarRef}
                      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                      initialView="dayGridMonth"
                      headerToolbar={{
                        left: "prev,next today",
                        center: "title",
                        right: "dayGridMonth,timeGridWeek,timeGridDay",
                      }}
                      height="auto"
                      timeZone={CASABLANCA_TZ}
                      events={events}
                      editable={false}
                      selectable
                      selectMirror
                      dayMaxEvents
                      datesSet={handleDatesSet}
                      eventClick={onEventClick}
                      dateClick={onDateClick}
                      select={onSelect}
                      eventDidMount={(info) => {
                        if (info.event.extendedProps?.kind === "meeting") {
                          const m = info.event.extendedProps.meeting as Meeting;
                          if (!parseIso(m.meetingDate)) {
                            info.el.title = "Date invalide";
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <MeetingsListSection
            canAssign={canAssign}
            assignableUsers={assignableUsers}
            reloadToken={listReloadToken}
            onView={openDetail}
            onEdit={openEdit}
          />
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
