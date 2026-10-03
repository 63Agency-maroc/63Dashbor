"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { Select } from "@/components/ui/Select";
import { UserSelect, employeesToUserSelectOptions } from "@/components/ui/UserSelect";
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

function rateToPct(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0;
  const pct = rate <= 1 ? rate * 100 : rate;
  return Math.round(pct * 10) / 10;
}

function progressClass(pct: number): string {
  if (pct >= 60) return "bg-success";
  if (pct >= 35) return "bg-primary";
  if (pct >= 15) return "bg-warning";
  return "bg-danger";
}

function progressTextClass(pct: number): string {
  if (pct >= 60) return "text-success";
  if (pct >= 35) return "text-primary";
  if (pct >= 15) return "text-warning";
  return "text-danger";
}

function MemberAvatar({
  name,
  src,
  sizeClass = "avatar-xxs",
}: {
  name: string;
  src?: string | null;
  sizeClass?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className={`avatar ${sizeClass} rounded-circle me-2 flex-shrink-0`}>
      {src ? (
        <img src={src} alt="" />
      ) : (
        <span className="bg-primary-subtle text-primary d-flex align-items-center justify-content-center w-100 h-100 fw-semibold small">
          {initials || "?"}
        </span>
      )}
    </div>
  );
}

function sumSetter(items: MeetingsByMemberItem[]) {
  return items.reduce((s, i) => s + (i.asSetter?.total ?? 0), 0);
}
function sumCloserDone(items: MeetingsByMemberItem[]) {
  return items.reduce((s, i) => s + (i.asCloser?.done ?? 0), 0);
}

export function TeamManagerPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { settings } = useThemeSettings();
  const isDark = settings.appTheme === "dark";
  const isAdmin = (user?.role ?? "") === "admin";

  const [periodKey, setPeriodKey] = useState<DashboardPeriodKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [memberFilter, setMemberFilter] = useState("");

  const range = useMemo(
    () => resolveDashboardPeriod(periodKey, customFrom, customTo, { maxDays: 366 }),
    [periodKey, customFrom, customTo],
  );

  const [data, setData] = useState<MeetingsByMemberResponse | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
      setEmployees(users);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setForbidden(true);
        setData(null);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Impossible de charger Team Manager.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, range.from, range.to]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const avatarById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const e of employees) m.set(e.id, e.avatarUrl);
    return m;
  }, [employees]);

  const allItems = data?.items ?? [];

  const memberOptions = useMemo(() => {
    const fromEmployees = employeesToUserSelectOptions(employees);
    if (fromEmployees.length) return fromEmployees;
    return allItems.map((i) => ({
      id: i.user.userId,
      prenom: i.user.prenom,
      nom: i.user.nom,
      email: i.user.email,
      role: i.user.role,
    }));
  }, [employees, allItems]);

  const focusedItem = useMemo(
    () => (memberFilter ? allItems.find((i) => i.user.userId === memberFilter) ?? null : null),
    [allItems, memberFilter],
  );

  const displayItems = useMemo(() => {
    let rows = memberFilter ? allItems.filter((i) => i.user.userId === memberFilter) : allItems;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((i) => {
        const blob = `${meetingUserDisplayName(i.user)} ${i.user.email ?? ""} ${i.user.role ?? ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    return rows;
  }, [allItems, memberFilter, search]);

  const totals = data?.totals;
  const kpiMeetings = focusedItem
    ? (focusedItem.asSetter?.total ?? 0) + (focusedItem.asCloser?.total ?? 0)
    : (totals?.totalMeetings ?? 0);
  const kpiDone = focusedItem
    ? (focusedItem.asCloser?.done ?? 0) + (focusedItem.asSetter?.done ?? 0)
    : (totals?.totalDone ?? 0);
  const kpiRate = focusedItem
    ? rateToPct(focusedItem.closerSuccessRate)
    : totals && totals.totalMeetings > 0
      ? Math.round((totals.totalDone / totals.totalMeetings) * 1000) / 10
      : 0;
  const kpiMembers = focusedItem ? 1 : allItems.length;
  const kpiSetterTotal = focusedItem ? (focusedItem.asSetter?.total ?? 0) : sumSetter(allItems);
  const kpiCloserDone = focusedItem ? (focusedItem.asCloser?.done ?? 0) : sumCloserDone(allItems);

  const topCards = useMemo(() => {
    const source = memberFilter && focusedItem ? [focusedItem] : allItems;
    return [...source]
      .sort((a, b) => (b.asCloser?.done ?? 0) - (a.asCloser?.done ?? 0))
      .slice(0, 4);
  }, [allItems, focusedItem, memberFilter]);

  const teamControl = useMemo(() => {
    const source = memberFilter && focusedItem ? [focusedItem] : allItems;
    return [...source]
      .sort((a, b) => (b.asCloser?.done ?? 0) - (a.asCloser?.done ?? 0))
      .slice(0, 6);
  }, [allItems, focusedItem, memberFilter]);

  const chartCategories = useMemo(
    () =>
      (memberFilter && focusedItem ? [focusedItem] : allItems)
        .slice(0, 8)
        .map((i) => meetingUserDisplayName(i.user)),
    [allItems, focusedItem, memberFilter],
  );
  const chartSetter = useMemo(
    () =>
      (memberFilter && focusedItem ? [focusedItem] : allItems)
        .slice(0, 8)
        .map((i) => i.asSetter?.total ?? 0),
    [allItems, focusedItem, memberFilter],
  );
  const chartCloser = useMemo(
    () =>
      (memberFilter && focusedItem ? [focusedItem] : allItems)
        .slice(0, 8)
        .map((i) => i.asCloser?.done ?? 0),
    [allItems, focusedItem, memberFilter],
  );

  const chartOptions: ApexOptions = useMemo(() => {
    const muted = isDark ? "rgba(232,232,232,0.55)" : "#6c757d";
    const grid = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
    const primary = isDark ? "#5b9fd4" : "#1F4E79";
    const success = "#198754";
    return {
      chart: {
        type: "bar",
        stacked: false,
        toolbar: { show: false },
        fontFamily: "Instrument Sans, system-ui, sans-serif",
        background: "transparent",
        foreColor: muted,
        height: 280,
      },
      colors: [primary, success],
      plotOptions: {
        bar: { horizontal: false, columnWidth: "48%", borderRadius: 4 },
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ["transparent"] },
      grid: { borderColor: grid, strokeDashArray: 4 },
      xaxis: {
        categories: chartCategories,
        labels: { style: { colors: muted, fontSize: "11px" }, rotate: -20 },
      },
      yaxis: {
        labels: { style: { colors: muted, fontSize: "11px" } },
      },
      legend: { position: "top", horizontalAlign: "right", labels: { colors: muted } },
      tooltip: { theme: isDark ? "dark" : "light" },
    };
  }, [chartCategories, isDark]);

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
    <div className="container-fluid">
      <div className="app-page-head d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <Link href="/">
                <i className="fi fi-rr-home" /> Home
              </Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Team Management
            </li>
          </ol>
        </nav>

        <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 flex-wrap">
          <Select
            size="sm"
            style={{ width: 180 }}
            value={periodKey}
            onChange={(v) => setPeriodKey(v as DashboardPeriodKey)}
            options={DASHBOARD_PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            aria-label="Période"
          />
          {periodKey === "custom" ? (
            <>
              <CasablancaDatePicker value={customFrom || range.from} onChange={setCustomFrom} placeholder="Du" />
              <CasablancaDatePicker value={customTo || range.to} onChange={setCustomTo} placeholder="Au" />
            </>
          ) : null}
          <div style={{ minWidth: 220 }}>
            <UserSelect
              size="sm"
              value={memberFilter}
              onChange={setMemberFilter}
              users={memberOptions}
              placeholder="Tous les membres"
              emptyLabel="Tous les membres"
              clearable
              aria-label="Filtrer par membre"
            />
          </div>
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

      {focusedItem ? (
        <div className="alert alert-primary-subtle border-0 d-flex align-items-center justify-content-between gap-2 mb-3">
          <div className="d-flex align-items-center min-w-0">
            <MemberAvatar
              name={meetingUserDisplayName(focusedItem.user)}
              src={avatarById.get(focusedItem.user.userId)}
              sizeClass="avatar-sm"
            />
            <div className="min-w-0">
              <div className="fw-semibold text-truncate">
                Focus · {meetingUserDisplayName(focusedItem.user)}
              </div>
              <div className="small text-muted">
                {roleLabel(focusedItem.user.role ?? undefined)} · {range.from} → {range.to}
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-primary flex-shrink-0" onClick={() => setMemberFilter("")}>
            Tous les membres
          </button>
        </div>
      ) : null}

      <div className="row">
        {/* KPI left — template team-management.html */}
        <div className="col-xxl-6">
          <div className="row">
            <div className="col-lg-6">
              <div className="row">
                <div className="col-12 col-sm-6 col-lg-12">
                  <div className="card">
                    <div className="card-header pb-0 border-0 d-flex align-items-center justify-content-between">
                      <h6 className="card-title mb-0">
                        {focusedItem ? "Meetings (membre)" : "Total meetings"}
                      </h6>
                      <span className="badge bg-primary-subtle text-primary">période</span>
                    </div>
                    <div className="card-body pt-3">
                      <h2 className="mb-0">{loading ? "—" : kpiMeetings}</h2>
                    </div>
                    <div className="card-footer">
                      <span>
                        {focusedItem
                          ? `Setter ${focusedItem.asSetter?.total ?? 0} · Closer ${focusedItem.asCloser?.total ?? 0}`
                          : `${range.from} → ${range.to}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-12">
                  <div className="card">
                    <div className="card-header pb-0 border-0 d-flex align-items-center justify-content-between">
                      <h6 className="card-title mb-0">
                        {focusedItem ? "Taux closer" : "Taux global"}
                      </h6>
                      <span className="badge bg-success-subtle text-success">{loading ? "—" : `${kpiRate}%`}</span>
                    </div>
                    <div className="card-body pt-3">
                      <h2 className="mb-0">{loading ? "—" : `${kpiRate}%`}</h2>
                    </div>
                    <div className="card-footer">
                      <span>
                        {focusedItem
                          ? `Closer done ${focusedItem.asCloser?.done ?? 0} / ${focusedItem.asCloser?.total ?? 0}`
                          : `Done ${kpiDone} / ${kpiMeetings}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header pb-0 border-0 d-flex align-items-center justify-content-between">
                  <h6 className="card-title mb-0">
                    {focusedItem ? "Membre sélectionné" : "Membres actifs"}
                  </h6>
                  <span className="badge bg-success-subtle text-success">
                    {loading ? "—" : kpiMembers}
                  </span>
                </div>
                <div className="card-body pt-2">
                  <h2 className="mb-0">{loading ? "—" : kpiMembers}</h2>
                  <p className="text-muted small mb-0 mt-2">
                    {focusedItem
                      ? meetingUserDisplayName(focusedItem.user)
                      : "Avec setter ou closer sur la période"}
                  </p>
                </div>
                <div className="card-footer p-0">
                  <div className="row g-0">
                    <div className="col-6 border-end p-3">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <h4 className="mb-0">{loading ? "—" : kpiSetterTotal}</h4>
                      </div>
                      <span>Setter total</span>
                    </div>
                    <div className="col-6 p-3">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <h4 className="mb-0">{loading ? "—" : kpiCloserDone}</h4>
                      </div>
                      <span>Closer done</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Performances chart */}
        <div className="col-xxl-6">
          <div className="card h-100">
            <div className="card-header pb-0 border-0 d-flex align-items-center justify-content-between">
              <h6 className="card-title mb-0">Team Performances</h6>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : chartCategories.length === 0 ? (
                <div className="text-center text-muted py-5">Aucune donnée de performance.</div>
              ) : (
                <ReactApexChart
                  type="bar"
                  height={280}
                  series={[
                    { name: "Setter", data: chartSetter },
                    { name: "Closer done", data: chartCloser },
                  ]}
                  options={chartOptions}
                />
              )}
            </div>
          </div>
        </div>

        {/* Recent performance cards (template "Recent Projects") */}
        <div className="col-xxl-9 col-xl-8">
          <div className="card">
            <div className="card-header pb-0 border-0 d-flex align-items-center justify-content-between">
              <h6 className="card-title mb-0">Top performances</h6>
              <span className="btn-link small text-muted">Closer done</span>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm" role="status" />
                </div>
              ) : topCards.length === 0 ? (
                <div className="text-center text-muted py-4 px-3">
                  Aucune donnée de performance sur cette période — les meetings avec setter/closer
                  apparaîtront ici.
                </div>
              ) : (
                <div className="row g-3">
                  {topCards.map((item) => {
                    const name = meetingUserDisplayName(item.user);
                    const pct = rateToPct(item.closerSuccessRate);
                    const closerTotal = item.asCloser?.total ?? 0;
                    const closerDone = item.asCloser?.done ?? 0;
                    return (
                      <div className="col-md-6" key={item.user.userId}>
                        <div className="card-body border rounded">
                          <div className="d-flex align-items-start justify-content-between">
                            <div className="clearfix min-w-0">
                              <h6 className="mb-1 text-truncate">{name}</h6>
                              <small>{roleLabel(item.user.role ?? undefined)}</small>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => setMemberFilter(item.user.userId)}
                            >
                              Focus
                            </button>
                          </div>
                          <hr className="my-3" />
                          <div className="d-flex align-items-end justify-content-between mb-2">
                            <div className="clearfix">
                              <h4 className="mb-0">
                                {closerDone}
                                <span className="text-body">/{closerTotal || "—"}</span>
                              </h4>
                              <span>Closer</span>
                            </div>
                            <span className={`${progressTextClass(pct)} fw-semibold mb-0`}>
                              <i className="fi fi-rr-arrow-trend-up me-1" /> {pct}%
                            </span>
                          </div>
                          <div className="progress bg-light" style={{ height: 8 }}>
                            <div
                              className={`progress-bar ${progressClass(pct)}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <div className="small text-muted mt-2">
                            Setter {item.asSetter?.total ?? 0}/{item.asSetter?.done ?? 0} (total/done)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Team Control sidebar list */}
        <div className="col-xxl-3 col-xl-4">
          <div className="card">
            <div className="card-header pb-0 border-0 d-flex align-items-center justify-content-between">
              <h6 className="card-title mb-0">Team Control</h6>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm" role="status" />
                </div>
              ) : teamControl.length === 0 ? (
                <div className="text-center text-muted py-4">Aucun membre.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {teamControl.map((item) => {
                    const name = meetingUserDisplayName(item.user);
                    return (
                      <li className="list-group-item px-0" key={item.user.userId}>
                        <div className="d-flex align-items-center">
                          <button
                            type="button"
                            className="btn btn-link text-decoration-none text-body p-0 d-flex align-items-center me-auto min-w-0 text-start"
                            onClick={() => setMemberFilter(item.user.userId)}
                          >
                            <MemberAvatar
                              name={name}
                              src={avatarById.get(item.user.userId)}
                              sizeClass="avatar"
                            />
                            <div className="clearfix min-w-0">
                              <h6 className="mb-0 text-truncate">{name}</h6>
                              <span className="text-2xs text-body">
                                {item.asCloser?.done ?? 0} closer done · {item.asSetter?.total ?? 0}{" "}
                                setter
                              </span>
                            </div>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Team Performance List — template table */}
        <div className="col-xxl-12">
          <div className="card overflow-hidden">
            <div className="card-header d-flex flex-wrap gap-3 align-items-center justify-content-between border-0 pb-0">
              <h6 className="card-title mb-0">Team Performance List</h6>
              <div className="position-relative" style={{ minWidth: 200, maxWidth: 280 }}>
                <i className="fi fi-rr-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                <input
                  type="search"
                  className="form-control form-control-sm ps-5"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="card-body px-1 pt-2 pb-2">
              {loading ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : displayItems.length === 0 ? (
                <div className="text-center text-muted py-5 px-3">
                  <div className="avatar avatar-lg bg-primary-subtle text-primary rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
                    <i className="fi fi-rr-leaderboard" />
                  </div>
                  <h6 className="mb-2">Aucune donnée de performance</h6>
                  <p className="mb-0 mx-auto" style={{ maxWidth: 440 }}>
                    Aucune donnée de performance sur cette période — les meetings avec setter/closer
                    apparaîtront ici.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm display table-row-rounded mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="minw-200px">Member Name</th>
                        <th className="minw-120px">Role</th>
                        <th className="minw-100px">Setter</th>
                        <th className="minw-100px">Setter done</th>
                        <th className="minw-100px">Closer</th>
                        <th className="minw-100px">Closer done</th>
                        <th className="minw-140px">Conversion Rate</th>
                        <th className="minw-100px">Status</th>
                        <th className="minw-80px">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item) => {
                        const name = meetingUserDisplayName(item.user);
                        const pct = rateToPct(item.closerSuccessRate);
                        const active =
                          (item.asSetter?.total ?? 0) + (item.asCloser?.total ?? 0) > 0;
                        return (
                          <tr key={item.user.userId}>
                            <td>
                              <div className="d-flex align-items-center">
                                <MemberAvatar
                                  name={name}
                                  src={avatarById.get(item.user.userId)}
                                />
                                {name}
                              </div>
                            </td>
                            <td>{roleLabel(item.user.role ?? undefined)}</td>
                            <td>{item.asSetter?.total ?? 0}</td>
                            <td>{item.asSetter?.done ?? 0}</td>
                            <td>{item.asCloser?.total ?? 0}</td>
                            <td>{item.asCloser?.done ?? 0}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <span className="fw-semibold">{pct}%</span>
                                <div className="progress bg-light flex-grow-1" style={{ height: 6, minWidth: 56 }}>
                                  <div
                                    className={`progress-bar ${progressClass(pct)}`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`badge badge-lg ${
                                  active
                                    ? "bg-success-subtle text-success"
                                    : "bg-secondary-subtle text-secondary"
                                }`}
                              >
                                {active ? "Active" : "Idle"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-subtle-primary btn-sm btn-shadow btn-icon"
                                title="Filtrer ce membre"
                                onClick={() => setMemberFilter(item.user.userId)}
                              >
                                <i className="fi fi-rr-eye" />
                              </button>
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
      </div>
    </div>
  );
}
