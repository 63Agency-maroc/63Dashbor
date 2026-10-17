import { api } from "@/lib/api/client";
import {
  normalizeWhatsappConversation,
  normalizeWhatsappMessage,
  type WhatsappConversation,
  type WhatsappMessage,
} from "@/lib/api/whatsapp";

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

export type LeadWhatsappThreadResponse = {
  conversation: WhatsappConversation | null;
  messages: WhatsappMessage[];
};

/** Thread WhatsApp lié au lead (conversation + messages) */
export async function getLeadWhatsappThread(id: string): Promise<LeadWhatsappThreadResponse> {
  const raw = await api.get<unknown>(`/leads/${id}/whatsapp-thread`);
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const conversationRaw = data.conversation ?? null;
  const messagesRaw = data.messages;
  return {
    conversation: conversationRaw != null ? normalizeWhatsappConversation(conversationRaw) : null,
    messages: Array.isArray(messagesRaw) ? messagesRaw.map(normalizeWhatsappMessage) : [],
  };
}

export type SendLeadTemplateDto = {
  templateName: string;
  language?: string;
  /** Clés = indices placeholder ("1", "2", …) */
  variables?: Record<string, string>;
};

/** Envoi d’un template WhatsApp lié au lead (crée / utilise la conversation) */
export async function sendLeadTemplate(id: string, dto: SendLeadTemplateDto) {
  const raw = await api.post<unknown>(`/leads/${id}/whatsapp/template`, dto);
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    return normalizeWhatsappMessage(raw);
  }
  return raw;
}

export type EmailDirection = "inbound" | "outbound";

export type EmailMessage = {
  id: string;
  direction: EmailDirection;
  subject: string | null;
  from: string | null;
  to: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type SendLeadEmailDto = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

function asEmailString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const s = value.trim();
    return s.length ? s : null;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return asEmailString(o.email ?? o.address ?? o.name);
  }
  const s = String(value).trim();
  return s.length ? s : null;
}

function normalizeEmailMessage(raw: unknown): EmailMessage {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dirRaw = String(m.direction ?? m.type ?? "")
    .trim()
    .toLowerCase();
  const direction: EmailDirection =
    dirRaw === "outbound" || dirRaw === "out" || dirRaw === "sent" || m.outbound === true
      ? "outbound"
      : "inbound";
  return {
    id: String(m.id ?? ""),
    direction,
    subject: asEmailString(m.subject),
    from: asEmailString(m.from ?? m.fromEmail ?? m.from_email ?? m.fromAddress ?? m.from_address),
    to: asEmailString(m.to ?? m.toEmail ?? m.to_email ?? m.toAddress ?? m.to_address),
    bodyHtml: asEmailString(m.bodyHtml ?? m.body_html ?? m.html),
    bodyText: asEmailString(m.bodyText ?? m.body_text ?? m.text ?? m.body),
    createdAt: String(m.createdAt ?? m.created_at ?? ""),
    sentAt: asEmailString(m.sentAt ?? m.sent_at),
  };
}

function extractEmailList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.emails)) return o.emails;
  if (Array.isArray(o.messages)) return o.messages;
  return [];
}

/** Historique email du lead */
export async function getLeadEmails(id: string): Promise<EmailMessage[]> {
  const raw = await api.get<unknown>(`/leads/${id}/emails`);
  return extractEmailList(raw).map(normalizeEmailMessage);
}

/** Envoi d’un email au lead via la boîte connectée */
export function sendLeadEmail(id: string, dto: SendLeadEmailDto) {
  return api.post<unknown>(`/leads/${id}/email`, dto);
}
