import { api } from "@/lib/api/client";

export type EmailOpenEvent = {
  email: string;
  channel?: string;
  subject?: string;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
};

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalize(row: unknown): EmailOpenEvent | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const email = asText(r.email).trim();
  if (!email) return null;
  const sentAt = asText(r.sent_at ?? r.sentAt).trim() || null;
  const openedAt = asText(r.opened_at ?? r.openedAt).trim() || null;
  const openCount = Number(r.open_count ?? r.openCount);
  return {
    email,
    channel: asText(r.channel).trim() || undefined,
    subject: asText(r.subject).trim() || undefined,
    sentAt,
    openedAt,
    openCount: Number.isFinite(openCount) ? openCount : 0,
  };
}

function pickList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const row = raw as Record<string, unknown>;
  for (const key of ["items", "data", "opens", "results"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [];
}

/** GET /email/opens?email=&limit= — tracking d’ouverture (JWT). */
export async function getEmailOpens(
  email: string,
  limit = 1,
): Promise<EmailOpenEvent[]> {
  const addr = email.trim();
  if (!addr) return [];
  const q = new URLSearchParams({
    email: addr,
    limit: String(Math.max(1, limit)),
  });
  const raw = await api.get<unknown>(`/email/opens?${q.toString()}`);
  return pickList(raw)
    .map(normalize)
    .filter((item): item is EmailOpenEvent => Boolean(item));
}
