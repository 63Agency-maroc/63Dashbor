import { api } from "@/lib/api/client";

export type ClickUpCustomField = {
  id?: string;
  name?: string;
  type?: string;
  value?: unknown;
};

export type LeadClickupData = {
  task?: {
    custom_fields?: ClickUpCustomField[];
    url?: string;
    description?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Contrat API Leads — camelCase exact */
export type Lead = {
  id: string;
  clickupTaskId: string;
  name: string;
  status: string;
  listId: string;
  listName: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  clickupData: LeadClickupData | null;
};

export type LeadsQuery = {
  status?: string;
  listId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type LeadsListResponse = {
  items: Lead[];
  total: number;
};

export type LeadsMetaResponse = {
  statuses: string[];
  lists: { id: string; name: string }[];
};

export type LeadsStatsResponse = {
  total: number;
  byStatus: Record<string, number>;
};

export type LeadsOverviewStatusRow = {
  status: string;
  count: number;
};

export type LeadsOverviewListRow = {
  listId: string;
  listName: string;
  count: number;
};

export type LeadsOverviewDayRow = {
  day: string;
  count: number;
};

export type LeadsOverviewResponse = {
  total: number;
  byStatus: LeadsOverviewStatusRow[];
  byList: LeadsOverviewListRow[];
  createdInPeriod: number;
  byDay: LeadsOverviewDayRow[];
};

export type SyncLeadsResponse = {
  ok: true;
  synced: number;
};

export type LeadDetailResponse = {
  item: Lead;
};

function buildQuery(params: LeadsQuery): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.listId) sp.set("listId", params.listId);
  if (params.search) sp.set("search", params.search);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function getLeads(params: LeadsQuery = {}) {
  return api.get<LeadsListResponse>(`/leads${buildQuery(params)}`);
}

/** Recherche leads (autocomplete) — search serveur name/phone/email */
export function searchLeads(term: string, limit = 8) {
  const search = term.trim();
  return getLeads({ search: search || undefined, limit });
}

export function getLeadsMeta() {
  return api.get<LeadsMetaResponse>("/leads/meta");
}

export function getLeadsStats() {
  return api.get<LeadsStatsResponse>("/leads/stats");
}

function buildDateRangeQuery(params: { from?: string; to?: string }): string {
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/** Overview leads pour dashboard admin — période from/to (heure Maroc) */
export function getLeadsStatsOverview(params: { from: string; to: string }) {
  return api.get<LeadsOverviewResponse>(
    `/leads/stats/overview${buildDateRangeQuery(params)}`,
  );
}

/** Sync ClickUp — opération longue (timeout 120s) */
export function syncLeads() {
  return api.post<SyncLeadsResponse>("/leads/sync", undefined, { timeoutMs: 120_000 });
}

export function getLead(id: string) {
  return api.get<LeadDetailResponse>(`/leads/${id}`);
}
