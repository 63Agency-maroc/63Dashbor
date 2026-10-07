import { api } from "@/lib/api/client";

export type DashboardKpis = {
  from: string | null;
  to: string | null;
  newLeads: number;
  meetingsFixed: number;
  meetingsDone: number;
  meetingsDoublons: number;
  leadsClosedWon: number;
  leadsLost: number;
};

/** KPIs business Dashboard Data — FULL ADMIN ; from/to optionnels (max 366j Casa) */
export function getDashboardKpis(params?: { from?: string; to?: string }) {
  const sp = new URLSearchParams();
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  const q = sp.toString();
  return api.get<DashboardKpis>(`/dashboard/kpis${q ? `?${q}` : ""}`);
}

export type AdminActivityType = "meeting_created" | "lead_upserted" | "broadcast_job" | string;

export type AdminActivityItem = {
  type: AdminActivityType;
  at: string;
  title: string;
  href?: string | null;
  meta?: Record<string, unknown> | null;
};

export type AdminActivityResponse = {
  items: AdminActivityItem[];
};

/** Fil d’activité récente — FULL ADMIN only */
export function getAdminActivity(params: { limit?: number } = {}) {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  const q = sp.toString();
  return api.get<AdminActivityResponse>(`/admin/activity${q ? `?${q}` : ""}`);
}

function stripPhoneNoise(raw: string): string {
  return raw
    .replace(/\+?\d[\d\s.\-]{6,}\d/g, " ") // numéros (ex. +212…)
    .replace(/[\s\-–—_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Libellé court pour le feed activité (évite "Lead Nom- +212…" trop long).
 * Préfère meta.name / meta.leadName quand dispo.
 */
export function formatActivityTitle(item: AdminActivityItem): string {
  const type = String(item.type ?? "").toLowerCase();
  const meta =
    item.meta && typeof item.meta === "object"
      ? (item.meta as Record<string, unknown>)
      : {};

  if (type.includes("lead")) {
    const fromMeta = [meta.name, meta.leadName, meta.contactName, meta.clientNom]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find(Boolean);
    let name = fromMeta || String(item.title ?? "");
    name = name.replace(/^lead\s+/i, "");
    name = stripPhoneNoise(name);
    name = name.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim();
    if (!name) name = "sans nom";
    // Cap logique avant ellipsis CSS
    if (name.length > 42) name = `${name.slice(0, 41).trimEnd()}…`;
    return `Lead ${name}`;
  }

  if (type.includes("meeting")) {
    let t = String(item.title ?? "").trim() || "Meeting";
    t = stripPhoneNoise(t);
    if (t.length > 48) t = `${t.slice(0, 47).trimEnd()}…`;
    return t;
  }

  if (type.includes("broadcast")) {
    let t = String(item.title ?? "").trim() || "Broadcast";
    if (t.length > 48) t = `${t.slice(0, 47).trimEnd()}…`;
    return t;
  }

  let t = String(item.title ?? "").trim() || "Activité";
  t = stripPhoneNoise(t);
  if (t.length > 48) t = `${t.slice(0, 47).trimEnd()}…`;
  return t;
}
