"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { Select } from "@/components/ui/Select";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";
import { MeetingsByDayChart } from "@/components/dashboard/MeetingsByDayChart";
import { MeetingsByStatusChart } from "@/components/dashboard/MeetingsByStatusChart";
import { LeadsByStatusChart } from "@/components/dashboard/LeadsByStatusChart";
import {
  getMeetingsStats,
  getMeetingsStatsByDay,
  getMeetingsStatsByMember,
  meetingUserDisplayName,
  type MeetingsByDayItem,
  type MeetingsByMemberItem,
  type MeetingsByMemberResponse,
  type MeetingsStats,
} from "@/lib/api/meetings";
import {
  getLeadsStatsOverview,
  type LeadsOverviewListRow,
  type LeadsOverviewResponse,
} from "@/lib/api/leads";
import { getWhatsappUnreadCount, type WhatsappUnreadCount } from "@/lib/api/whatsapp";
import {
  listBroadcasts,
  type BroadcastJobStatus,
  type BroadcastJobSummary,
} from "@/lib/api/broadcast";
import {
  employeeFullName,
  getUsers,
  normalizePresenceUpdate,
  type Employee,
} from "@/lib/api/users";
import { formatActivityTitle, getAdminActivity, type AdminActivityItem } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import {
  DASHBOARD_PERIOD_OPTIONS,
  resolveDashboardPeriod,
  type DashboardPeriodKey,
} from "@/lib/dashboard/period";
import { formatDateTime } from "@/lib/datetime/timezone";
import { useViewerTimezone } from "@/hooks/useViewerTimezone";
import { getSocket } from "@/lib/realtime/socket";
import { roleLabel } from "@/lib/auth/storage";

function broadcastBadgeClass(status: BroadcastJobStatus | string): string {
  const s = String(status).toLowerCase();
  if (s === "completed" || s === "done" || s === "success") return "bg-success-subtle text-success";
  if (s === "failed" || s === "error") return "bg-danger-subtle text-danger";
  if (s === "cancelled" || s === "canceled") return "bg-secondary-subtle text-secondary";
  if (s === "running" || s === "queued" || s === "processing") return "bg-primary-subtle text-primary";
  return "bg-warning-subtle text-warning";
}

function activityIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("meeting")) return "fi fi-rr-calendar";
  if (t.includes("lead")) return "fi fi-rr-user";
  if (t.includes("broadcast")) return "fi fi-rr-paper-plane";
  return "fi fi-rr-bell";
}

function formatRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${Math.round(pct * 10) / 10} %`;
}

function memberName(item: MeetingsByMemberItem): string {
  return meetingUserDisplayName({
    userId: item.user.userId,
    prenom: item.user.prenom,
    nom: item.user.nom,
    email: item.user.email,
  });
}

function MemberAvatar({
  name,
  src,
}: {
  name: string;
  src?: string | null;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    return (
      <img src={src} alt="" className="rounded-circle" width={32} height={32} style={{ objectFit: "cover" }} />
    );
  }
  return (
    <span
      className="avatar avatar-sm bg-primary-subtle text-primary rounded-circle d-inline-flex align-items-center justify-content-center"
      style={{ width: 32, height: 32, fontSize: 11, fontWeight: 600 }}
    >
      {initials || "?"}
    </span>
  );
}

export function AdminDashboard() {
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
  const [byMember, setByMember] = useState<MeetingsByMemberResponse | null>(null);
  const [leadsOverview, setLeadsOverview] = useState<LeadsOverviewResponse | null>(null);
  const [unread, setUnread] = useState<WhatsappUnreadCount | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastJobSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activity, setActivity] = useState<AdminActivityItem[]>([]);

  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [loadingWa, setLoadingWa] = useState(true);
  const [loadingPresence, setLoadingPresence] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const loadKpis = useCallback(async () => {
    setLoadingKpis(true);
    try {
      const s = await getMeetingsStats();
      setStats(s);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les stats meetings.");
    } finally {
      setLoadingKpis(false);
    }
  }, []);

  const loadPeriodData = useCallback(async (from: string, to: string) => {
    setLoadingPeriod(true);
    // Appels indépendants : un échec (ex. leads/by-member) ne doit pas vider le chart by-day
    const [daySettled, memberSettled, leadsSettled] = await Promise.allSettled([
      getMeetingsStatsByDay({ from, to }),
      getMeetingsStatsByMember({ from, to }),
      getLeadsStatsOverview({ from, to }),
    ]);

    if (daySettled.status === "fulfilled") {
      const items = daySettled.value.items ?? [];
      setByDay(items);
      if (items.length === 0 && process.env.NODE_ENV !== "production") {
        console.info(
          `[dashboard] GET /meetings/stats/by-day?from=${from}&to=${to} → items vide`,
        );
      }
    } else {
      setByDay([]);
      const err = daySettled.reason;
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[dashboard] GET /meetings/stats/by-day?from=${from}&to=${to} échoué`,
          err instanceof ApiError ? `${err.status} ${err.message}` : err,
        );
      }
      if (err instanceof ApiError) {
        if (err.status === 403) setError("Accès réservé au full admin.");
        else if (/180|range|période|period/i.test(err.message)) {
          setError("Période trop longue pour le chart (max 180 jours).");
        }
      }
    }

    if (memberSettled.status === "fulfilled") {
      setByMember(memberSettled.value);
    } else {
      setByMember(null);
      const err = memberSettled.reason;
      if (err instanceof ApiError && err.status === 403) {
        setError("Accès réservé au full admin.");
      }
    }

    if (leadsSettled.status === "fulfilled") {
      setLeadsOverview(leadsSettled.value);
    } else {
      setLeadsOverview(null);
    }

    setLoadingPeriod(false);
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
      /* keep */
    } finally {
      setLoadingWa(false);
    }
  }, []);

  const loadPresence = useCallback(async () => {
    setLoadingPresence(true);
    try {
      const list = await getUsers();
      setEmployees(list);
    } catch {
      setEmployees([]);
    } finally {
      setLoadingPresence(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const res = await getAdminActivity({ limit: 30 });
      setActivity(res.items ?? []);
    } catch {
      setActivity([]);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    void loadKpis();
    void loadWhatsapp();
    void loadPresence();
    void loadActivity();
  }, [loadKpis, loadWhatsapp, loadPresence, loadActivity]);

  useEffect(() => {
    void loadPeriodData(range.from, range.to);
  }, [range.from, range.to, loadPeriodData]);

  useEffect(() => {
    let socket: ReturnType<typeof getSocket> | null = null;
    let unreadTimer: ReturnType<typeof setTimeout> | undefined;
    let activityTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleUnread = () => {
      if (unreadTimer) clearTimeout(unreadTimer);
      unreadTimer = setTimeout(() => void loadWhatsapp(), 500);
    };
    const scheduleActivity = () => {
      if (activityTimer) clearTimeout(activityTimer);
      activityTimer = setTimeout(() => void loadActivity(), 800);
    };

    try {
      socket = getSocket();
      setLiveConnected(socket.connected);
      const onConnect = () => setLiveConnected(true);
      const onDisconnect = () => setLiveConnected(false);
      const onPresence = (raw: unknown) => {
        const ev = normalizePresenceUpdate(raw);
        if (!ev) return;
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === ev.userId
              ? { ...e, online: ev.online, lastSeen: ev.lastSeen ?? e.lastSeen }
              : e,
          ),
        );
      };

      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("presence:update", onPresence);
      socket.on("message:created", scheduleUnread);
      socket.on("conversation:updated", scheduleUnread);
      const onBroadcastDone = () => {
        scheduleUnread();
        scheduleActivity();
      };
      socket.on("broadcast:done", onBroadcastDone);

      return () => {
        if (unreadTimer) clearTimeout(unreadTimer);
        if (activityTimer) clearTimeout(activityTimer);
        socket?.off("connect", onConnect);
        socket?.off("disconnect", onDisconnect);
        socket?.off("presence:update", onPresence);
        socket?.off("message:created", scheduleUnread);
        socket?.off("conversation:updated", scheduleUnread);
        socket?.off("broadcast:done", onBroadcastDone);
      };
    } catch {
      setLiveConnected(false);
      return undefined;
    }
  }, [loadWhatsapp, loadActivity]);

  const onlineEmployees = useMemo(() => employees.filter((e) => e.online), [employees]);
  const onlineCount = onlineEmployees.length;
  const totalEmployees = employees.length;

  const byListSorted: LeadsOverviewListRow[] = useMemo(
    () => [...(leadsOverview?.byList ?? [])].sort((a, b) => b.count - a.count),
    [leadsOverview],
  );

  const avatarByUserId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of employees) map.set(e.id, e.avatarUrl);
    return map;
  }, [employees]);

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
                Dashboard Data
              </li>
            </ol>
          </nav>
          <h1 className="h4 mb-0">Vue d&apos;ensemble</h1>
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

      {/* KPIs meetings */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="Aujourd'hui"
            value={loadingKpis ? "—" : (stats?.today ?? 0)}
            subtext="Meetings du jour"
            iconColor="primary"
            icon={<i className="fi fi-rr-calendar-day" />}
          />
        </div>
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="Cette semaine"
            value={loadingKpis ? "—" : (stats?.thisWeek ?? 0)}
            subtext="Semaine en cours"
            iconColor="info"
            icon={<i className="fi fi-rr-calendar-week" />}
          />
        </div>
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="En attente"
            value={loadingKpis ? "—" : (stats?.pending ?? 0)}
            subtext="À traiter"
            iconColor="warning"
            icon={<i className="fi fi-rr-hourglass-end" />}
          />
        </div>
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="À venir"
            value={loadingKpis ? "—" : (stats?.upcomingCount ?? 0)}
            subtext="Prochains meetings"
            iconColor="success"
            icon={<i className="fi fi-rr-calendar-clock" />}
          />
        </div>
        <div className="col-6 col-md-4 col-xl">
          <StatCard
            label="No-show"
            value={loadingKpis ? "—" : (stats?.noShow ?? 0)}
            subtext="Absences"
            iconColor="danger"
            icon={<i className="fi fi-rr-user-slash" />}
          />
        </div>
      </div>

      {/* Charts meetings */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-7">
          <div className="card h-100">
            <div className="card-header border-0 pb-0">
              <h6 className="card-title mb-0">Meetings par jour</h6>
            </div>
            <div className="card-body pt-2">
              <MeetingsByDayChart items={byDay} loading={loadingPeriod} />
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-5">
          <div className="card h-100">
            <div className="card-header border-0 pb-0">
              <h6 className="card-title mb-0">Répartition par statut</h6>
            </div>
            <div className="card-body pt-2">
              <MeetingsByStatusChart byStatus={stats?.byStatus ?? null} loading={loadingKpis} />
            </div>
          </div>
        </div>
      </div>

      {/* Perf équipe */}
      <div className="card mb-3">
        <div className="card-header border-0 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
          <div>
            <h6 className="card-title mb-0">Performance équipe</h6>
            <span className="small text-muted">
              Setter / Closer — base commissions (counts + taux, sans montants)
              {byMember?.totals
                ? ` · ${byMember.totals.totalMeetings} meetings · ${byMember.totals.totalDone} done`
                : ""}
            </span>
          </div>
          <Link href="/calendar" className="btn btn-sm btn-outline-primary">
            Calendrier
          </Link>
        </div>
        <div className="card-body pt-0">
          {loadingPeriod ? (
            <div className="d-flex align-items-center justify-content-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
              Chargement…
            </div>
          ) : !byMember?.items?.length ? (
            <div className="text-center text-muted py-5">Aucune donnée d&apos;équipe sur la période.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th className="text-end">Setter</th>
                    <th className="text-end">Setter done</th>
                    <th className="text-end">Closer</th>
                    <th className="text-end">Closer done</th>
                    <th className="text-end">Taux closer</th>
                  </tr>
                </thead>
                <tbody>
                  {byMember.items.map((row) => {
                    const name = memberName(row);
                    return (
                      <tr key={row.user.userId}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <MemberAvatar name={name} src={avatarByUserId.get(row.user.userId)} />
                            <div className="min-w-0">
                              <div className="fw-medium text-truncate">{name}</div>
                              <div className="small text-muted text-truncate">
                                {roleLabel(row.user.role ?? undefined)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-end font-monospace">{row.asSetter?.total ?? 0}</td>
                        <td className="text-end font-monospace">{row.asSetter?.done ?? 0}</td>
                        <td className="text-end font-monospace">{row.asCloser?.total ?? 0}</td>
                        <td className="text-end font-monospace">{row.asCloser?.done ?? 0}</td>
                        <td className="text-end">
                          <span className="badge bg-primary-subtle text-primary">
                            {formatRate(row.closerSuccessRate)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Leads */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-6 col-xl-3">
          <StatCard
            label="Leads total"
            value={loadingPeriod ? "—" : (leadsOverview?.total ?? 0)}
            subtext="Tous statuts"
            iconColor="primary"
            icon={<i className="fi fi-rr-users" />}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <StatCard
            label="Créés (période)"
            value={loadingPeriod ? "—" : (leadsOverview?.createdInPeriod ?? 0)}
            subtext={`${range.from} → ${range.to}`}
            iconColor="success"
            icon={<i className="fi fi-rr-user-add" />}
          />
        </div>
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header border-0 d-flex align-items-center justify-content-between">
              <h6 className="card-title mb-0">Leads par jour</h6>
              <Link href="/leads" className="btn btn-sm btn-outline-primary">
                Voir les leads
              </Link>
            </div>
            <div className="card-body pt-0">
              <MeetingsByDayChart
                items={leadsOverview?.byDay ?? []}
                loading={loadingPeriod}
                seriesName="Leads"
                emptyLabel="Aucun lead créé sur cette période."
              />
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-header border-0 pb-0">
              <h6 className="card-title mb-0">Leads par statut</h6>
            </div>
            <div className="card-body pt-2">
              <LeadsByStatusChart items={leadsOverview?.byStatus ?? []} loading={loadingPeriod} />
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-header border-0 pb-0">
              <h6 className="card-title mb-0">Répartition par liste</h6>
            </div>
            <div className="card-body pt-0">
              {loadingPeriod ? (
                <div className="d-flex align-items-center justify-content-center py-5 text-muted">
                  <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                  Chargement…
                </div>
              ) : byListSorted.length === 0 ? (
                <div className="text-center text-muted py-5">Aucune liste.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {byListSorted.slice(0, 10).map((row) => {
                    const total = leadsOverview?.total || 1;
                    const pct = Math.round((row.count / total) * 1000) / 10;
                    return (
                      <li
                        key={row.listId || row.listName}
                        className="list-group-item px-0 bg-transparent"
                      >
                        <div className="d-flex justify-content-between gap-2 mb-1">
                          <span className="text-truncate">{row.listName || "Sans liste"}</span>
                          <span className="font-monospace small flex-shrink-0">
                            {row.count} · {pct}%
                          </span>
                        </div>
                        <div className="progress" style={{ height: 6 }}>
                          <div
                            className="progress-bar bg-primary"
                            role="progressbar"
                            style={{ width: `${Math.min(100, pct)}%` }}
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
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

      {/* WhatsApp + Présence + Activité */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-4">
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
                    <div className="text-center text-muted py-4">
                      <div className="spinner-border spinner-border-sm" role="status" />
                    </div>
                  ) : broadcasts.length === 0 ? (
                    <div className="text-center text-muted py-4">Aucun broadcast récent.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {broadcasts.map((j) => {
                        const waSent = j.waSent ?? j.sent;
                        const waFailed = j.waFailed ?? j.failed;
                        return (
                          <li key={j.id} className="list-group-item px-0 bg-transparent">
                            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                              <span className={`badge ${broadcastBadgeClass(j.status)}`}>{j.status}</span>
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

        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-header border-0 d-flex align-items-center justify-content-between">
              <h6 className="card-title mb-0">Présence équipe</h6>
              <Link href="/employees" className="btn btn-sm btn-outline-primary">
                Employés
              </Link>
            </div>
            <div className="card-body pt-0">
              <div className="mb-3">
                <StatCard
                  label="En ligne"
                  value={loadingPresence ? "—" : `${onlineCount} / ${totalEmployees}`}
                  subtext="Membres connectés"
                  iconColor="success"
                  icon={<i className="fi fi-rr-wifi" />}
                />
              </div>
              {loadingPresence ? (
                <div className="text-center text-muted py-3">
                  <div className="spinner-border spinner-border-sm" role="status" />
                </div>
              ) : onlineEmployees.length === 0 ? (
                <div className="text-center text-muted py-3">Personne en ligne.</div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {onlineEmployees.slice(0, 12).map((e) => (
                    <li key={e.id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                      <span className="position-relative">
                        <MemberAvatar name={employeeFullName(e)} src={e.avatarUrl} />
                        <span
                          className="position-absolute bottom-0 end-0 rounded-circle border border-2 border-body"
                          style={{ width: 10, height: 10, background: "#22c55e" }}
                          aria-hidden
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="fw-medium text-truncate">{employeeFullName(e)}</div>
                        <div className="small text-muted text-truncate">{roleLabel(e.role)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-header border-0">
              <h6 className="card-title mb-0">Activité récente</h6>
            </div>
            <div className="card-body pt-0">
              {loadingActivity ? (
                <div className="text-center text-muted py-4">
                  <div className="spinner-border spinner-border-sm" role="status" />
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center text-muted py-4">Aucune activité récente.</div>
              ) : (
                <ul className="list-unstyled mb-0 app-activity-feed">
                  {activity.map((item, idx) => {
                    const label = formatActivityTitle(item);
                    const fullTitle = (item.title || label).trim();
                    const body = (
                      <div className="app-activity-feed__row d-flex align-items-center gap-2">
                        <span
                          className="avatar avatar-sm bg-primary-subtle text-primary rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
                          style={{ width: 32, height: 32 }}
                        >
                          <i className={activityIcon(item.type)} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-grow-1 overflow-hidden">
                          <div className="fw-medium text-truncate" title={fullTitle}>
                            {label}
                          </div>
                          <div className="small text-muted text-truncate">
                            {formatDateTime(item.at, viewerTimezone)}
                          </div>
                        </div>
                      </div>
                    );
                    const href =
                      item.href && item.href.startsWith("/") && !item.href.startsWith("//")
                        ? item.href
                        : null;
                    return (
                      <li key={`${item.type}-${item.at}-${idx}`} className="app-activity-feed__item">
                        {href ? (
                          <Link href={href} className="text-decoration-none text-body d-block">
                            {body}
                          </Link>
                        ) : (
                          body
                        )}
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
  );
}
