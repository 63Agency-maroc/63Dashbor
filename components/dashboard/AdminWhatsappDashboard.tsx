"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { Select } from "@/components/ui/Select";
import { MeetingsByDayChart } from "@/components/dashboard/MeetingsByDayChart";
import { MeetingsByStatusChart } from "@/components/dashboard/MeetingsByStatusChart";
import {
  getMeetingsStats,
  getMeetingsStatsByDay,
  getMeetingsToday,
  getMeetingsUpcoming,
  type Meeting,
  type MeetingsByDayItem,
  type MeetingsStats,
} from "@/lib/api/meetings";
import { getWhatsappUnreadCount, type WhatsappUnreadCount } from "@/lib/api/whatsapp";
import {
  listBroadcasts,
  type BroadcastJobSummary,
  type BroadcastJobStatus,
} from "@/lib/api/broadcast";
import { ApiError } from "@/lib/api/client";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";
import {
  DASHBOARD_PERIOD_OPTIONS,
  resolveDashboardPeriod,
  type DashboardPeriodKey,
} from "@/lib/dashboard/period";
import { formatDateTime } from "@/lib/datetime/timezone";
import { useViewerTimezone } from "@/hooks/useViewerTimezone";
import { getStatusPalette } from "@/lib/calendar/statusPalette";
import { getSocket } from "@/lib/realtime/socket";

function assigneeNames(m: Meeting): string {
  const fromAssignees = (m.assignees ?? [])
    .map((a) => [a.prenom, a.nom].filter(Boolean).join(" ").trim() || a.email || a.id)
    .filter(Boolean);
  if (fromAssignees.length) return fromAssignees.join(", ");
  return (m.assignedUserIds ?? []).join(", ") || "—";
}

function broadcastBadgeClass(status: BroadcastJobStatus | string): string {
  const s = String(status).toLowerCase();
  if (s === "completed" || s === "done" || s === "success") return "bg-success-subtle text-success";
  if (s === "failed" || s === "error") return "bg-danger-subtle text-danger";
  if (s === "cancelled" || s === "canceled") return "bg-secondary-subtle text-secondary";
  if (s === "running" || s === "queued" || s === "processing") return "bg-primary-subtle text-primary";
  return "bg-warning-subtle text-warning";
}

function mergeMeetings(today: Meeting[], upcoming: Meeting[], limit = 12): Meeting[] {
  const map = new Map<string, Meeting>();
  for (const m of [...today, ...upcoming]) {
    if (m?.id) map.set(m.id, m);
  }
  return [...map.values()]
    .sort((a, b) => String(a.meetingDate).localeCompare(String(b.meetingDate)))
    .slice(0, limit);
}

export function AdminWhatsappDashboard() {
  const viewerTimezone = useViewerTimezone();
  const [periodKey, setPeriodKey] = useState<DashboardPeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(
    () => resolveDashboardPeriod(periodKey, customFrom, customTo),
    [periodKey, customFrom, customTo],
  );

  const [stats, setStats] = useState<MeetingsStats | null>(null);
  const [byDay, setByDay] = useState<MeetingsByDayItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [unread, setUnread] = useState<WhatsappUnreadCount | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastJobSummary[]>([]);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [loadingWa, setLoadingWa] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const s = await getMeetingsStats();
      setStats(s);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les stats.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadChart = useCallback(async (from: string, to: string) => {
    setLoadingChart(true);
    try {
      const res = await getMeetingsStatsByDay({ from, to });
      setByDay(res.items ?? []);
    } catch {
      setByDay([]);
    } finally {
      setLoadingChart(false);
    }
  }, []);

  const loadMeetings = useCallback(async () => {
    setLoadingMeetings(true);
    try {
      const [todayRes, upcomingRes] = await Promise.all([
        getMeetingsToday(),
        getMeetingsUpcoming(),
      ]);
      setMeetings(mergeMeetings(todayRes.items ?? [], upcomingRes.items ?? []));
    } catch {
      setMeetings([]);
    } finally {
      setLoadingMeetings(false);
    }
  }, []);

  const loadWhatsapp = useCallback(async () => {
    setLoadingWa(true);
    try {
      const [u, b] = await Promise.all([
        getWhatsappUnreadCount(),
        listBroadcasts({ limit: 5 }),
      ]);
      setUnread(u);
      setBroadcasts(b.items ?? []);
    } catch {
      /* keep previous */
    } finally {
      setLoadingWa(false);
    }
  }, []);

  const loadUnreadOnly = useCallback(async () => {
    try {
      const u = await getWhatsappUnreadCount();
      setUnread(u);
    } catch {
      /* ignore */
    }
  }, []);

  const loadBroadcastsOnly = useCallback(async () => {
    try {
      const b = await listBroadcasts({ limit: 5 });
      setBroadcasts(b.items ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadMeetings();
    void loadWhatsapp();
  }, [loadStats, loadMeetings, loadWhatsapp]);

  useEffect(() => {
    void loadChart(range.from, range.to);
  }, [range.from, range.to, loadChart]);

  useEffect(() => {
    let socket: ReturnType<typeof getSocket> | null = null;
    let unreadTimer: ReturnType<typeof setTimeout> | undefined;
    let broadcastTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleUnread = () => {
      if (unreadTimer) clearTimeout(unreadTimer);
      unreadTimer = setTimeout(() => void loadUnreadOnly(), 400);
    };
    const scheduleBroadcasts = () => {
      if (broadcastTimer) clearTimeout(broadcastTimer);
      broadcastTimer = setTimeout(() => void loadBroadcastsOnly(), 500);
    };

    try {
      socket = getSocket();
      setLiveConnected(socket.connected);
      const onConnect = () => setLiveConnected(true);
      const onDisconnect = () => setLiveConnected(false);
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("message:created", scheduleUnread);
      socket.on("conversation:updated", scheduleUnread);
      socket.on("broadcast:progress", scheduleBroadcasts);
      socket.on("broadcast:done", scheduleBroadcasts);

      return () => {
        if (unreadTimer) clearTimeout(unreadTimer);
        if (broadcastTimer) clearTimeout(broadcastTimer);
        socket?.off("connect", onConnect);
        socket?.off("disconnect", onDisconnect);
        socket?.off("message:created", scheduleUnread);
        socket?.off("conversation:updated", scheduleUnread);
        socket?.off("broadcast:progress", scheduleBroadcasts);
        socket?.off("broadcast:done", scheduleBroadcasts);
      };
    } catch {
      setLiveConnected(false);
      return undefined;
    }
  }, [loadUnreadOnly, loadBroadcastsOnly]);

  return (
    <div className="container-fluid">
      <div className="app-page-head d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-1">
              <li className="breadcrumb-item">
                <Link href="/">
                  <i className="fi fi-rr-home" /> Accueil
                </Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Dashboard
              </li>
            </ol>
          </nav>
          <p className="text-muted small mb-0">
            Période {range.from} → {range.to}
            <span className="ms-2">
              <span
                className="rounded-circle d-inline-block align-middle me-1"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: liveConnected ? "#22c55e" : "#9ca3af",
                }}
                aria-hidden
              />
              {liveConnected ? "live" : "hors ligne"}
            </span>
          </p>
        </div>

        <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2">
          <Select
            size="sm"
            style={{ width: 200 }}
            value={periodKey}
            onChange={(v) => setPeriodKey(v as DashboardPeriodKey)}
            options={DASHBOARD_PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            aria-label="Période du dashboard"
          />
          {periodKey === "custom" ? (
            <>
              <CasablancaDatePicker
                value={customFrom || range.from}
                onChange={setCustomFrom}
                placeholder="Du"
              />
              <CasablancaDatePicker
                value={customTo || range.to}
                onChange={setCustomTo}
                placeholder="Au"
              />
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}

      {/* StatCards meetings */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="Aujourd'hui"
            value={loadingStats ? "—" : (stats?.today ?? 0)}
            subtext="Meetings du jour"
            iconColor="primary"
            icon={<i className="fi fi-rr-calendar-day" />}
          />
        </div>
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="Cette semaine"
            value={loadingStats ? "—" : (stats?.thisWeek ?? 0)}
            subtext="Semaine en cours"
            iconColor="info"
            icon={<i className="fi fi-rr-calendar-week" />}
          />
        </div>
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="En attente"
            value={loadingStats ? "—" : (stats?.pending ?? 0)}
            subtext="À traiter"
            iconColor="warning"
            icon={<i className="fi fi-rr-hourglass-end" />}
          />
        </div>
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="À venir"
            value={loadingStats ? "—" : (stats?.upcomingCount ?? 0)}
            subtext="Prochains meetings"
            iconColor="success"
            icon={<i className="fi fi-rr-calendar-clock" />}
          />
        </div>
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="No-show"
            value={loadingStats ? "—" : (stats?.noShow ?? 0)}
            subtext="Absences"
            iconColor="danger"
            icon={<i className="fi fi-rr-user-slash" />}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-7">
          <div className="card h-100">
            <div className="card-header border-0 pb-0">
              <h6 className="card-title mb-0">Meetings par jour</h6>
              <span className="small text-muted">
                {range.from} → {range.to}
              </span>
            </div>
            <div className="card-body pt-2">
              <MeetingsByDayChart items={byDay} loading={loadingChart} />
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-5">
          <div className="card h-100">
            <div className="card-header border-0 pb-0">
              <h6 className="card-title mb-0">Répartition par statut</h6>
            </div>
            <div className="card-body pt-2">
              <MeetingsByStatusChart byStatus={stats?.byStatus ?? null} loading={loadingStats} />
            </div>
          </div>
        </div>
      </div>

      {/* Meetings + WhatsApp */}
      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <div className="card h-100">
            <div className="card-header border-0 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
              <h6 className="card-title mb-0">Meetings à venir</h6>
              <Link href="/calendar" className="btn btn-sm btn-outline-primary">
                Voir dans le calendrier
              </Link>
            </div>
            <div className="card-body pt-0">
              {loadingMeetings ? (
                <div className="d-flex align-items-center justify-content-center py-5 text-muted">
                  <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                  Chargement…
                </div>
              ) : meetings.length === 0 ? (
                <div className="text-center text-muted py-5">
                  <i className="fi fi-rr-calendar d-block mb-2 fs-3 opacity-50" />
                  Aucun meeting à venir.
                </div>
              ) : (
                <ul className="list-group list-group-flush">
                  {meetings.map((m) => {
                    const palette = getStatusPalette(m.status);
                    return (
                      <li
                        key={m.id}
                        className="list-group-item px-0 bg-transparent d-flex flex-column flex-sm-row align-items-sm-center gap-2 gap-sm-3"
                      >
                        <div className="text-nowrap small text-muted" style={{ minWidth: 128 }}>
                          {formatDateTime(m.meetingDate, viewerTimezone)}
                        </div>
                        <div className="min-w-0 flex-grow-1">
                          <div className="fw-medium text-truncate">
                            {m.title || "Meeting"}
                            {m.contactName ? (
                              <span className="text-muted fw-normal"> · {m.contactName}</span>
                            ) : null}
                          </div>
                          <div className="small text-muted text-truncate">
                            {assigneeNames(m)}
                          </div>
                        </div>
                        <span className={`badge ${palette.badgeClass} flex-shrink-0`}>
                          {palette.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="row g-3">
            <div className="col-12">
              <Link href="/whatsapp" className="text-decoration-none text-body d-block">
                <StatCard
                  label="Messages non lus"
                  value={loadingWa && !unread ? "—" : (unread?.totalUnread ?? 0)}
                  subtext={
                    unread
                      ? `${unread.conversationsWithUnread} conversation${
                          unread.conversationsWithUnread === 1 ? "" : "s"
                        } · Ouvrir WhatsApp`
                      : "Ouvrir WhatsApp"
                  }
                  iconColor="success"
                  icon={<i className="fi fi-brands-whatsapp" />}
                />
              </Link>
            </div>
            <div className="col-12">
              <div className="card">
                <div className="card-header border-0 d-flex align-items-center justify-content-between gap-2">
                  <h6 className="card-title mb-0">Derniers broadcasts</h6>
                  <Link href="/whatsapp/broadcast" className="btn btn-sm btn-outline-primary">
                    Voir tout
                  </Link>
                </div>
                <div className="card-body pt-0">
                  {loadingWa && broadcasts.length === 0 ? (
                    <div className="d-flex align-items-center justify-content-center py-4 text-muted">
                      <div
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden
                      />
                      Chargement…
                    </div>
                  ) : broadcasts.length === 0 ? (
                    <div className="text-center text-muted py-4">
                      <i className="fi fi-rr-paper-plane d-block mb-2 fs-4 opacity-50" />
                      Aucun broadcast récent.
                    </div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {broadcasts.map((j) => {
                        const waSent = j.waSent ?? j.sent;
                        const waFailed = j.waFailed ?? j.failed;
                        return (
                          <li
                            key={j.id}
                            className="list-group-item px-0 bg-transparent d-flex align-items-start justify-content-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                <span className={`badge ${broadcastBadgeClass(j.status)}`}>
                                  {j.status}
                                </span>
                                <span className="small text-muted">
                                  {j.total} destinataire{j.total === 1 ? "" : "s"}
                                </span>
                              </div>
                              <div className="small text-muted">
                                WA {waSent}/{j.total}
                                {waFailed ? ` · ${waFailed} échec${waFailed === 1 ? "" : "s"}` : ""}
                              </div>
                              <div className="small text-muted">
                                {formatDateTime(j.createdAt, viewerTimezone)}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
