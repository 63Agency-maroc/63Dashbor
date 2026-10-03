"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { StatCard } from "@/components/ui/StatCard";
import { Select } from "@/components/ui/Select";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";
import { useAuth } from "@/components/providers/AuthProvider";
import { useThemeSettings } from "@/components/providers/ThemeProvider";
import {
  getMeetingsStatsByMember,
  meetingUserDisplayName,
  type MeetingsByMemberItem,
  type MeetingsByMemberResponse,
} from "@/lib/api/meetings";
import { getUsers, type Employee } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import {
  DASHBOARD_PERIOD_OPTIONS,
  resolveDashboardPeriod,
  type DashboardPeriodKey,
} from "@/lib/dashboard/period";
import { roleLabel } from "@/lib/auth/storage";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type SortKey = "rank" | "name" | "setterTotal" | "setterDone" | "closerTotal" | "closerDone" | "rate";

function rateToPct(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0;
  const pct = rate <= 1 ? rate * 100 : rate;
  return Math.round(pct * 10) / 10;
}

function formatPct(rate: number | null | undefined): string {
  return `${rateToPct(rate)} %`;
}

function progressTone(pct: number): string {
  if (pct >= 60) return "success";
  if (pct >= 35) return "primary";
  if (pct >= 15) return "warning";
  return "danger";
}

function MemberAvatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="rounded-circle flex-shrink-0"
        width={size}
        height={size}
        style={{ objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center flex-shrink-0 fw-semibold"
      style={{ width: size, height: size, fontSize: size > 36 ? 13 : 11 }}
    >
      {initials || "?"}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const top = rank <= 3;
  const cls =
    rank === 1
      ? "team-mgr__rank team-mgr__rank--gold"
      : rank === 2
        ? "team-mgr__rank team-mgr__rank--silver"
        : rank === 3
          ? "team-mgr__rank team-mgr__rank--bronze"
          : "team-mgr__rank";
  return (
    <span className={cls} title={`Rang #${rank}`}>
      {top ? <i className="fi fi-rr-trophy" aria-hidden /> : null}
      <span>#{rank}</span>
    </span>
  );
}

function SortTh({
  label,
  active,
  dir,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "end";
  onClick: () => void;
}) {
  return (
    <th className={align === "end" ? "text-end" : undefined}>
      <button
        type="button"
        className={`btn btn-link btn-sm p-0 text-decoration-none team-mgr__sort${active ? " is-active" : ""}`}
        onClick={onClick}
      >
        {label}
        {active ? (
          <i className={`fi fi-rr-caret-${dir === "asc" ? "up" : "down"} ms-1`} aria-hidden />
        ) : (
          <i className="fi fi-rr-sort ms-1 opacity-50" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function TeamManagerPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { settings } = useThemeSettings();
  const isDark = settings.appTheme === "dark";
  const isAdmin = (user?.role ?? "") === "admin";

  const [periodKey, setPeriodKey] = useState<DashboardPeriodKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(
    () => resolveDashboardPeriod(periodKey, customFrom, customTo, { maxDays: 366 }),
    [periodKey, customFrom, customTo],
  );

  const [data, setData] = useState<MeetingsByMemberResponse | null>(null);
  const [avatars, setAvatars] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    if (!isAdmin) {
      setForbidden(true);
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [res, users] = await Promise.all([
        getMeetingsStatsByMember({ from: range.from, to: range.to }),
        getUsers().catch(() => [] as Employee[]),
      ]);
      setData(res);
      const map = new Map<string, string | null>();
      for (const u of users) map.set(u.id, u.avatarUrl);
      setAvatars(map);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setForbidden(true);
        setData(null);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Impossible de charger la performance équipe.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, range.from, range.to]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "rank" ? "asc" : "desc");
    }
  }

  const rankedItems = useMemo(() => {
    const items = data?.items ?? [];
    // Rang = ordre API (closer.done DESC…)
    return items.map((item, idx) => ({ item, apiRank: idx + 1 }));
  }, [data]);

  const sortedRows = useMemo(() => {
    const rows = [...rankedItems];
    const mul = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const ia = a.item;
      const ib = b.item;
      switch (sortKey) {
        case "name":
          return (
            mul *
            meetingUserDisplayName(ia.user).localeCompare(meetingUserDisplayName(ib.user), "fr")
          );
        case "setterTotal":
          return mul * ((ia.asSetter?.total ?? 0) - (ib.asSetter?.total ?? 0));
        case "setterDone":
          return mul * ((ia.asSetter?.done ?? 0) - (ib.asSetter?.done ?? 0));
        case "closerTotal":
          return mul * ((ia.asCloser?.total ?? 0) - (ib.asCloser?.total ?? 0));
        case "closerDone":
          return mul * ((ia.asCloser?.done ?? 0) - (ib.asCloser?.done ?? 0));
        case "rate":
          return mul * (rateToPct(ia.closerSuccessRate) - rateToPct(ib.closerSuccessRate));
        case "rank":
        default:
          return mul * (a.apiRank - b.apiRank);
      }
    });
    return rows;
  }, [rankedItems, sortKey, sortDir]);

  const totals = data?.totals;
  const totalMeetings = totals?.totalMeetings ?? 0;
  const totalDone = totals?.totalDone ?? 0;
  const globalRate = totalMeetings > 0 ? (totalDone / totalMeetings) * 100 : 0;
  const memberCount = data?.items?.length ?? 0;

  const topClosers = useMemo(
    () =>
      [...(data?.items ?? [])]
        .sort((a, b) => (b.asCloser?.done ?? 0) - (a.asCloser?.done ?? 0))
        .slice(0, 8),
    [data],
  );
  const chartSeriesData = useMemo(
    () => topClosers.map((r) => r.asCloser?.done ?? 0),
    [topClosers],
  );
  const chartHasData = chartSeriesData.some((n) => n > 0);

  const chartOptions: ApexOptions = useMemo(() => {
    const muted = isDark ? "rgba(232,232,232,0.55)" : "#6c757d";
    const grid = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
    const primary = isDark ? "#5b9fd4" : "#1F4E79";
    return {
      chart: {
        type: "bar",
        toolbar: { show: false },
        fontFamily: "Instrument Sans, system-ui, sans-serif",
        background: "transparent",
        foreColor: muted,
      },
      plotOptions: {
        bar: { horizontal: true, borderRadius: 4, barHeight: "62%" },
      },
      colors: [primary],
      dataLabels: { enabled: false },
      grid: { borderColor: grid, strokeDashArray: 4 },
      xaxis: {
        categories: topClosers.map((r) => meetingUserDisplayName(r.user)),
        labels: { style: { colors: muted, fontSize: "11px" } },
      },
      yaxis: { labels: { style: { colors: muted, fontSize: "11px" } } },
      tooltip: {
        theme: isDark ? "dark" : "light",
        y: { formatter: (v) => `${v} done` },
      },
    };
  }, [topClosers, isDark]);

  if (authLoading) {
    return (
      <div className="container-fluid py-5 text-center text-muted">
        <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
        Chargement…
      </div>
    );
  }

  if (forbidden || !isAdmin) {
    return (
      <div className="container-fluid">
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="avatar avatar-lg bg-warning-subtle text-warning rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
              <i className="fi fi-rr-lock scale-2x" />
            </div>
            <h5 className="mb-2">Accès réservé</h5>
            <p className="text-muted mb-0">Team Manager est réservé aux administrateurs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid team-mgr">
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
                Team Manager
              </li>
            </ol>
          </nav>
          <h1 className="h4 mb-0">Team Manager</h1>
          <p className="text-muted small mb-0">
            Performance setter / closer · {range.from} → {range.to}
          </p>
        </div>

        <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2">
          <Select
            size="sm"
            style={{ width: 200 }}
            value={periodKey}
            onChange={(v) => setPeriodKey(v as DashboardPeriodKey)}
            options={DASHBOARD_PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            aria-label="Période Team Manager"
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
        <div className="alert alert-danger" role="alert">
          {error}
          <button type="button" className="btn btn-sm btn-outline-danger ms-3" onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      ) : null}

      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-3">
          <StatCard
            label="Total meetings"
            value={loading ? "—" : totalMeetings}
            subtext="Sur la période"
            iconColor="primary"
            icon={<i className="fi fi-rr-calendar" />}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            label="Total done"
            value={loading ? "—" : totalDone}
            subtext="Meetings conclus"
            iconColor="success"
            icon={<i className="fi fi-rr-check" />}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            label="Taux global"
            value={loading ? "—" : `${Math.round(globalRate * 10) / 10} %`}
            subtext="Done / meetings"
            iconColor="info"
            icon={<i className="fi fi-rr-chart-pie" />}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            label="Membres actifs"
            value={loading ? "—" : memberCount}
            subtext="Avec setter ou closer"
            iconColor="warning"
            icon={<i className="fi fi-rr-users" />}
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <div className="card team-mgr__board h-100">
            <div className="card-header border-0 d-flex align-items-center justify-content-between gap-2">
              <div>
                <h6 className="card-title mb-0">Classement performance</h6>
                <span className="small text-muted">Tri API : closer done → setter total</span>
              </div>
              <i className="fi fi-rr-leaderboard-trophy text-primary fs-4" aria-hidden />
            </div>
            <div className="card-body pt-0">
              {loading ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border text-primary" role="status" />
                  <p className="mt-3 mb-0">Chargement du classement…</p>
                </div>
              ) : sortedRows.length === 0 ? (
                <div className="team-mgr__empty text-center py-5 px-3">
                  <div className="team-mgr__empty-icon mx-auto mb-3">
                    <i className="fi fi-rr-leaderboard" aria-hidden />
                  </div>
                  <h6 className="mb-2">Aucune donnée de performance</h6>
                  <p className="text-muted mb-0 mx-auto" style={{ maxWidth: 420 }}>
                    Aucune donnée de performance sur cette période — les meetings avec setter/closer
                    apparaîtront ici.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0 team-mgr__table">
                    <thead>
                      <tr>
                        <SortTh
                          label="Rang"
                          active={sortKey === "rank"}
                          dir={sortDir}
                          onClick={() => toggleSort("rank")}
                        />
                        <SortTh
                          label="Membre"
                          active={sortKey === "name"}
                          dir={sortDir}
                          onClick={() => toggleSort("name")}
                        />
                        <SortTh
                          label="Setter"
                          active={sortKey === "setterTotal"}
                          dir={sortDir}
                          align="end"
                          onClick={() => toggleSort("setterTotal")}
                        />
                        <SortTh
                          label="Closer"
                          active={sortKey === "closerTotal"}
                          dir={sortDir}
                          align="end"
                          onClick={() => toggleSort("closerTotal")}
                        />
                        <SortTh
                          label="Taux closer"
                          active={sortKey === "rate"}
                          dir={sortDir}
                          onClick={() => toggleSort("rate")}
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map(({ item, apiRank }) => {
                        const name = meetingUserDisplayName(item.user);
                        const pct = rateToPct(item.closerSuccessRate);
                        const tone = progressTone(pct);
                        const isTop = apiRank <= 3;
                        return (
                          <tr key={item.user.userId} className={isTop ? "team-mgr__row--top" : undefined}>
                            <td style={{ width: 72 }}>
                              <RankBadge rank={apiRank} />
                            </td>
                            <td>
                              <div className="d-flex align-items-center gap-3">
                                <MemberAvatar name={name} src={avatars.get(item.user.userId)} />
                                <div className="min-w-0">
                                  <div className="fw-semibold text-truncate">{name}</div>
                                  <span className="badge bg-secondary-subtle text-secondary">
                                    {roleLabel(item.user.role ?? undefined)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="text-end">
                              <div className="fw-semibold font-monospace">
                                {item.asSetter?.total ?? 0}
                                <span className="text-muted"> / {item.asSetter?.done ?? 0}</span>
                              </div>
                              <div className="small text-muted">total / done</div>
                            </td>
                            <td className="text-end">
                              <div className="fw-semibold font-monospace">
                                {item.asCloser?.total ?? 0}
                                <span className="text-muted"> / {item.asCloser?.done ?? 0}</span>
                              </div>
                              <div className="small text-muted">total / done</div>
                            </td>
                            <td style={{ minWidth: 160 }}>
                              <div className="d-flex justify-content-between small mb-1">
                                <span className="text-muted">Réussite</span>
                                <span className={`fw-semibold text-${tone}`}>{formatPct(item.closerSuccessRate)}</span>
                              </div>
                              <div className="progress team-mgr__progress" role="progressbar" aria-valuenow={pct}>
                                <div
                                  className={`progress-bar bg-${tone}`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
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
        </div>

        <div className="col-12 col-xl-4">
          <div className="card h-100">
            <div className="card-header border-0">
              <h6 className="card-title mb-0">Top closers</h6>
              <span className="small text-muted">Meetings closer done</span>
            </div>
            <div className="card-body pt-0">
              {loading ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border spinner-border-sm" role="status" />
                </div>
              ) : !chartHasData ? (
                <div className="text-center text-muted py-5">
                  <i className="fi fi-rr-chart-histogram d-block mb-2 fs-3 opacity-50" />
                  Pas encore de closers sur la période.
                </div>
              ) : (
                <ReactApexChart
                  type="bar"
                  height={Math.max(240, chartSeriesData.length * 42)}
                  series={[{ name: "Closer done", data: chartSeriesData }]}
                  options={chartOptions}
                />
              )}
            </div>
          </div>

          {/* Mobile-friendly cards mirror of top 3 */}
          {!loading && sortedRows.length > 0 ? (
            <div className="d-xl-none mt-3">
              <div className="row g-3">
                {sortedRows.slice(0, 3).map(({ item, apiRank }) => (
                  <TopMemberCard
                    key={item.user.userId}
                    item={item}
                    rank={apiRank}
                    avatar={avatars.get(item.user.userId)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TopMemberCard({
  item,
  rank,
  avatar,
}: {
  item: MeetingsByMemberItem;
  rank: number;
  avatar?: string | null;
}) {
  const name = meetingUserDisplayName(item.user);
  const pct = rateToPct(item.closerSuccessRate);
  const tone = progressTone(pct);
  return (
    <div className="col-12 col-md-4">
      <div className="card team-mgr__podium-card h-100">
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 mb-3">
            <RankBadge rank={rank} />
            <MemberAvatar name={name} src={avatar} size={36} />
            <div className="min-w-0">
              <div className="fw-semibold text-truncate">{name}</div>
              <span className="badge bg-secondary-subtle text-secondary">
                {roleLabel(item.user.role ?? undefined)}
              </span>
            </div>
          </div>
          <div className="d-flex justify-content-between small mb-2">
            <span className="text-muted">Setter</span>
            <span className="font-monospace">
              {item.asSetter?.total ?? 0}/{item.asSetter?.done ?? 0}
            </span>
          </div>
          <div className="d-flex justify-content-between small mb-2">
            <span className="text-muted">Closer</span>
            <span className="font-monospace">
              {item.asCloser?.total ?? 0}/{item.asCloser?.done ?? 0}
            </span>
          </div>
          <div className="progress team-mgr__progress">
            <div className={`progress-bar bg-${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="small text-end mt-1 text-muted">{formatPct(item.closerSuccessRate)}</div>
        </div>
      </div>
    </div>
  );
}
