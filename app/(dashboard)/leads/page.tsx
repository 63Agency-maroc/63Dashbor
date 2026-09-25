"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getLead,
  getLeads,
  getLeadsMeta,
  getLeadsStats,
  type Lead,
  type LeadsMetaResponse,
  type LeadsStatsResponse,
} from "@/lib/api/leads";
import { getLeadEmail, getLeadName, getLeadPhoneDisplay } from "@/lib/leads/clickup-fields";
import { ApiError } from "@/lib/api/client";
import { AppToast } from "@/components/clients/AppToast";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { getSocket } from "@/lib/realtime/socket";
import { Select } from "@/components/ui/Select";
import { StatCard, type StatCardAccent } from "@/components/ui/StatCard";
import { formatDate } from "@/lib/utils/date";

const LIMIT = 50;
const HIGHLIGHT_MS = 3500;
const DELETE_FADE_MS = 320;
const STATS_DEBOUNCE_MS = 600;

type LeadDeletedPayload = {
  id: string;
  clickupTaskId: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  new: "bg-primary-subtle text-primary",
  contacted: "bg-info-subtle text-info",
  qualified: "bg-success-subtle text-success",
  engaged: "bg-warning-subtle text-warning",
  lost: "bg-danger-subtle text-danger",
  won: "bg-success-subtle text-success",
};

const STAT_ACCENTS: StatCardAccent[] = [
  "primary",
  "success",
  "secondary",
  "warning",
  "info",
  "dark",
];

const STATUS_STAT_ICONS: Record<string, string> = {
  new: "icon-sparkles",
  contacted: "icon-phone",
  qualified: "icon-badge-check",
  engaged: "icon-message-circle",
  lost: "icon-circle-x",
  won: "icon-trophy",
};

function statusStatIcon(status: string) {
  const key = status.trim().toLowerCase();
  return STATUS_STAT_ICONS[key] || "icon-chart-column";
}

function statusBadgeClass(status: string) {
  const key = status.trim().toLowerCase();
  return STATUS_BADGE[key] || "bg-secondary-subtle text-secondary";
}

function dash(v: string | undefined | null) {
  const s = (v ?? "").trim();
  return s || "—";
}

/** Aligné sur les filtres serveur (approx. pour search). */
function matchesActiveFilters(lead: Lead, status: string, listId: string, search: string) {
  if (status && lead.status !== status) return false;
  if (listId && lead.listId !== listId) return false;
  if (search) {
    const q = search.toLowerCase();
    const hay = `${lead.name ?? ""} ${lead.phone ?? ""} ${lead.email ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function hasRestrictiveFilters(status: string, listId: string, search: string) {
  return Boolean(status || listId || search);
}

export default function LeadsPage() {
  const { connected: liveConnected } = useRealtime();

  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<LeadsMetaResponse | null>(null);
  const [stats, setStats] = useState<LeadsStatsResponse | null>(null);

  const [status, setStatus] = useState("");
  const [listId, setListId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" | "info" } | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [pendingNewLeads, setPendingNewLeads] = useState(false);

  const filtersRef = useRef({ status, listId, search, offset });
  filtersRef.current = { status, listId, search, offset };

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const loadLeadsRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  const highlightTimers = useRef<Map<string, number>>(new Map());
  const deleteTimers = useRef<Map<string, number>>(new Map());
  const statsDebounceRef = useRef<number | null>(null);

  // Debounce recherche → serveur
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearch((prev) => {
        if (prev !== next) {
          setOffset(0);
        }
        return next;
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadMetaAndStats = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([getLeadsMeta(), getLeadsStats()]);
      setMeta(m);
      setStats(s);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      }
    }
  }, []);

  const refreshStatsDebounced = useCallback(() => {
    if (statsDebounceRef.current != null) {
      window.clearTimeout(statsDebounceRef.current);
    }
    statsDebounceRef.current = window.setTimeout(() => {
      void getLeadsStats()
        .then((s) => setStats(s))
        .catch(() => {
          /* silencieux — overlay live */
        });
    }, STATS_DEBOUNCE_MS);
  }, []);

  const flashRow = useCallback((id: string) => {
    setHighlightedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const prevTimer = highlightTimers.current.get(id);
    if (prevTimer != null) window.clearTimeout(prevTimer);
    const t = window.setTimeout(() => {
      setHighlightedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      highlightTimers.current.delete(id);
    }, HIGHLIGHT_MS);
    highlightTimers.current.set(id, t);
  }, []);

  const loadLeads = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setTableLoading(true);
      setError(null);
      try {
        const res = await getLeads({
          status: status || undefined,
          listId: listId || undefined,
          search: search || undefined,
          limit: LIMIT,
          offset,
        });
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotal(typeof res.total === "number" ? res.total : 0);
        setForbidden(false);
        setPendingNewLeads(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          setItems([]);
          setTotal(0);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Impossible de charger les leads.");
        setItems([]);
        setTotal(0);
      } finally {
        setTableLoading(false);
        setLoading(false);
      }
    },
    [status, listId, search, offset],
  );

  loadLeadsRef.current = loadLeads;

  useEffect(() => {
    void loadMetaAndStats();
  }, [loadMetaAndStats]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  // Temps réel : lead:created / lead:updated / lead:deleted (+ cleanup au démontage)
  useEffect(() => {
    if (forbidden) return;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onCreated = (lead: Lead) => {
      if (!lead?.id) return;
      const { status: st, listId: lid, search: q, offset: off } = filtersRef.current;
      refreshStatsDebounced();

      const matches = matchesActiveFilters(lead, st, lid, q);
      const canInsertLive = off === 0 && !hasRestrictiveFilters(st, lid, q);

      if (canInsertLive && matches) {
        const exists = itemsRef.current.some((x) => x.id === lead.id);
        setItems((prev) => {
          if (prev.some((x) => x.id === lead.id)) {
            return prev.map((x) => (x.id === lead.id ? { ...x, ...lead } : x));
          }
          return [lead, ...prev].slice(0, LIMIT);
        });
        if (!exists) setTotal((t) => t + 1);
        flashRow(lead.id);
        setToast({
          message: `Nouveau lead : ${lead.name || "sans nom"}`,
          variant: "info",
        });
        return;
      }

      if (matches) {
        setPendingNewLeads(true);
      }
    };

    const onUpdated = (lead: Lead) => {
      if (!lead?.id) return;
      const { status: st, listId: lid, search: q } = filtersRef.current;
      refreshStatsDebounced();

      const wasPresent = itemsRef.current.some((x) => x.id === lead.id);
      if (!wasPresent) return;

      if (!matchesActiveFilters(lead, st, lid, q)) {
        setItems((prev) => prev.filter((x) => x.id !== lead.id));
        setTotal((t) => Math.max(0, t - 1));
        return;
      }

      setItems((prev) => prev.map((x) => (x.id === lead.id ? { ...x, ...lead } : x)));
      setDetailLead((cur) => (cur?.id === lead.id ? { ...cur, ...lead } : cur));
      flashRow(lead.id);
    };

    const onDeleted = (payload: LeadDeletedPayload) => {
      if (!payload?.id && !payload?.clickupTaskId) return;
      refreshStatsDebounced();

      const match = itemsRef.current.find(
        (x) =>
          x.id === payload.id ||
          (payload.clickupTaskId != null &&
            payload.clickupTaskId !== "" &&
            x.clickupTaskId === payload.clickupTaskId),
      );
      if (!match) return;

      const removeId = match.id;

      setDetailLead((cur) => {
        if (cur?.id === removeId) {
          setDetailOpen(false);
          return null;
        }
        return cur;
      });

      setToast({ message: "Lead supprimé", variant: "info" });

      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.add(removeId);
        return next;
      });

      const prevTimer = deleteTimers.current.get(removeId);
      if (prevTimer != null) window.clearTimeout(prevTimer);

      const t = window.setTimeout(() => {
        deleteTimers.current.delete(removeId);

        const remaining = itemsRef.current.filter((x) => x.id !== removeId);
        const { offset: off } = filtersRef.current;

        setItems((prev) => prev.filter((x) => x.id !== removeId));
        setTotal((n) => Math.max(0, n - 1));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(removeId);
          return next;
        });

        if (remaining.length === 0) {
          if (off > 0) {
            setOffset(Math.max(0, off - LIMIT));
          } else {
            void loadLeadsRef.current({ silent: true });
          }
        }
      }, DELETE_FADE_MS);
      deleteTimers.current.set(removeId, t);
    };

    socket.on("lead:created", onCreated);
    socket.on("lead:updated", onUpdated);
    socket.on("lead:deleted", onDeleted);

    return () => {
      socket.off("lead:created", onCreated);
      socket.off("lead:updated", onUpdated);
      socket.off("lead:deleted", onDeleted);
    };
  }, [forbidden, flashRow, refreshStatsDebounced]);

  useEffect(() => {
    return () => {
      if (statsDebounceRef.current != null) window.clearTimeout(statsDebounceRef.current);
      highlightTimers.current.forEach((tm) => window.clearTimeout(tm));
      highlightTimers.current.clear();
      deleteTimers.current.forEach((tm) => window.clearTimeout(tm));
      deleteTimers.current.clear();
    };
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const rangeFrom = total === 0 ? 0 : offset + 1;
  const rangeTo = Math.min(offset + LIMIT, total);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(pageCount, currentPage + 2);
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }, [currentPage, pageCount]);

  const statusEntries = useMemo(() => {
    if (!stats?.byStatus) return [];
    return Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);
  }, [stats]);

  function onFilterStatus(value: string) {
    setStatus(value);
    setOffset(0);
    setPendingNewLeads(false);
  }

  function onFilterList(value: string) {
    setListId(value);
    setOffset(0);
    setPendingNewLeads(false);
  }

  function goToPage(page: number) {
    const p = Math.min(Math.max(1, page), pageCount);
    setOffset((p - 1) * LIMIT);
    setPendingNewLeads(false);
  }

  async function openDetail(lead: Lead) {
    setDetailOpen(true);
    setDetailLead(lead);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await getLead(lead.id);
      setDetailLead(res.item);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Impossible de charger le détail.");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="container-fluid">
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Leads
            </li>
          </ol>
        </nav>
      </div>

      {forbidden ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="avatar avatar-lg bg-warning-subtle text-warning rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
              <i className="fi fi-rr-lock scale-2x" />
            </div>
            <h5 className="mb-2">Accès non autorisé aux leads</h5>
            <p className="text-muted mb-0">Votre rôle ne permet pas de consulter les leads.</p>
          </div>
        </div>
      ) : (
        <div className="row">
          <div className="col-12 col-md-6 col-lg-4 col-xxl-2 mb-3">
            <StatCard
              label="Total Leads"
              value={stats?.total ?? "—"}
              subtext="Tous statuts"
              iconColor="primary"
              icon={<i className="icon-users" />}
            />
          </div>
          {statusEntries.slice(0, 5).map(([label, count], idx) => (
            <div className="col-12 col-md-6 col-lg-4 col-xxl-2 mb-3" key={label}>
              <StatCard
                label={label}
                value={count}
                subtext="par statut"
                iconColor={STAT_ACCENTS[(idx + 1) % STAT_ACCENTS.length]}
                icon={<i className={statusStatIcon(label)} />}
              />
            </div>
          ))}

          {/* TODO: pas d'API — charts Leads by Source / Opportunity Value / Pipelines retirés */}

          <div className="col-12">
            <div className="card position-relative">
              <div className="card-header d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-3 border-0 pb-0">
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <h6 className="card-title mb-0">Recent Leads</h6>
                  <span
                    className="d-inline-flex align-items-center gap-1 small text-muted"
                    title={liveConnected ? "Temps réel connecté" : "Temps réel hors ligne"}
                  >
                    <span
                      className="rounded-circle d-inline-block"
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: liveConnected ? "#22c55e" : "#9ca3af",
                      }}
                      aria-hidden
                    />
                    {liveConnected ? "live" : "hors ligne"}
                  </span>
                </div>
                <div className="d-flex flex-column flex-sm-row flex-sm-nowrap align-items-stretch align-items-sm-center gap-2 ms-md-auto">
                  <div className="position-relative flex-grow-1" style={{ minWidth: 180, maxWidth: 280 }}>
                    <i className="fi fi-rr-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                    <input
                      type="search"
                      className="form-control form-control-sm ps-5 w-100"
                      placeholder="Search name, phone, email…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                  </div>
                  <Select
                    size="sm"
                    className="flex-shrink-0"
                    style={{ width: 180, minWidth: 160 }}
                    value={status}
                    onChange={onFilterStatus}
                    placeholder="All statuses"
                    options={[
                      { value: "", label: "All statuses" },
                      ...(meta?.statuses ?? []).map((s) => ({ value: s, label: s })),
                    ]}
                    aria-label="Filter by status"
                  />
                  <Select
                    size="sm"
                    className="flex-shrink-0"
                    style={{ width: 200, minWidth: 170 }}
                    value={listId}
                    onChange={onFilterList}
                    placeholder="All lists"
                    options={[
                      { value: "", label: "All lists" },
                      ...(meta?.lists ?? []).map((l) => ({ value: l.id, label: l.name })),
                    ]}
                    aria-label="Filter by list"
                  />
                </div>
              </div>

              {pendingNewLeads ? (
                <div className="alert alert-info border-0 rounded-0 mb-0 d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2">
                  <span className="small mb-0">Nouveaux leads disponibles</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-info"
                    onClick={() => {
                      setPendingNewLeads(false);
                      if (offset !== 0) {
                        setOffset(0);
                      } else {
                        void loadLeads();
                      }
                    }}
                  >
                    Recharger
                  </button>
                </div>
              ) : null}

              <div className="card-body px-1 pt-2 pb-2">
                {tableLoading ? (
                  <div
                    className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                    style={{ background: "rgba(255,255,255,0.55)", zIndex: 2 }}
                  >
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading…</span>
                    </div>
                  </div>
                ) : null}

                {loading && items.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                    <p className="text-muted mt-3 mb-0">Chargement des leads…</p>
                  </div>
                ) : error ? (
                  <div className="alert alert-danger m-3" role="alert">
                    {error}
                    <button type="button" className="btn btn-sm btn-outline-danger ms-3" onClick={() => void loadLeads()}>
                      Réessayer
                    </button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-5 text-muted">Aucun lead.</div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <table className="table table-sm display table-row-rounded mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Lead Name</th>
                            <th>Status</th>
                            <th>Phone</th>
                            <th>Email</th>
                            <th>List</th>
                            <th>Updated</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((lead) => {
                            const isRemoving = removingIds.has(lead.id);
                            const isHighlighted = highlightedIds.has(lead.id);
                            return (
                            <tr
                              key={lead.id}
                              style={{
                                cursor: isRemoving ? "default" : "pointer",
                                transition: "background-color 0.4s ease, opacity 0.3s ease",
                                opacity: isRemoving ? 0 : 1,
                                backgroundColor: isRemoving
                                  ? "rgba(239, 68, 68, 0.08)"
                                  : isHighlighted
                                    ? "rgba(34, 197, 94, 0.12)"
                                    : undefined,
                              }}
                              onClick={() => {
                                if (!isRemoving) void openDetail(lead);
                              }}
                            >
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="avatar avatar-xxs rounded-circle me-2 bg-primary-subtle text-primary d-flex align-items-center justify-content-center">
                                    {(getLeadName(lead) || lead.name || "?").charAt(0).toUpperCase()}
                                  </div>
                                  {dash(getLeadName(lead) || lead.name)}
                                </div>
                              </td>
                              <td>
                                <span className={`badge ${statusBadgeClass(lead.status)}`}>{dash(lead.status)}</span>
                              </td>
                              <td>{dash(getLeadPhoneDisplay(lead) || lead.phone)}</td>
                              <td>{dash(getLeadEmail(lead) || lead.email)}</td>
                              <td>{dash(lead.listName)}</td>
                              <td>{formatDate(lead.updatedAt)}</td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="btn btn-subtle-secondary btn-sm btn-shadow btn-icon waves-effect"
                                  title="Voir"
                                  onClick={() => void openDetail(lead)}
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

                    <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between px-3 py-2 border-top">
                      <small className="text-muted">
                        {rangeFrom}–{rangeTo} sur {total}
                      </small>
                      <div className="btn-group">
                        <button
                          type="button"
                          className="btn btn-sm btn-white btn-shadow"
                          disabled={currentPage <= 1 || tableLoading}
                          onClick={() => goToPage(currentPage - 1)}
                        >
                          Prev
                        </button>
                        {pageNumbers.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`btn btn-sm btn-shadow ${p === currentPage ? "btn-primary" : "btn-white"}`}
                            disabled={tableLoading}
                            onClick={() => goToPage(p)}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn btn-sm btn-white btn-shadow"
                          disabled={currentPage >= pageCount || tableLoading}
                          onClick={() => goToPage(currentPage + 1)}
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
        </div>
      )}

      <LeadDetailModal
        open={detailOpen}
        lead={detailLead}
        loading={detailLoading}
        error={detailError}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
