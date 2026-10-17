import { api, ApiError } from "@/lib/api/client";

export type MailAccount = {
  id?: string;
  email: string;
  provider?: string | null;
  connected: boolean;
};

function asTrimmed(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function normalizeMailAccount(raw: unknown): MailAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const nested = o.account ?? o.item ?? o.mailAccount ?? o.mail_account;
  const src =
    nested && typeof nested === "object" ? (nested as Record<string, unknown>) : o;

  const email = asTrimmed(src.email ?? src.address ?? src.from);
  const connectedRaw = src.connected ?? src.configured ?? src.isConnected ?? src.is_connected;
  const connected =
    connectedRaw === true ||
    connectedRaw === "true" ||
    connectedRaw === 1 ||
    (connectedRaw == null && Boolean(email));

  if (!connected && !email) return null;
  if (connectedRaw === false || connectedRaw === "false") return null;

  return {
    id: asTrimmed(src.id) ?? undefined,
    email: email ?? "",
    provider: asTrimmed(src.provider),
    connected: true,
  };
}

/** Boîte mail de l’utilisateur connecté. null = non configurée (404 inclus). */
export async function getMailAccount(): Promise<MailAccount | null> {
  try {
    const raw = await api.get<unknown>("/mail/account");
    return normalizeMailAccount(raw);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 204)) return null;
    throw err;
  }
}
