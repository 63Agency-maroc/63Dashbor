import { API_BASE_URL } from "@/lib/api/config";
import { api, ApiError } from "@/lib/api/client";
import { clearSession, getToken } from "@/lib/auth/storage";

export type MailFolder = {
  /** Chemin IMAP envoyé comme `folder` */
  id: string;
  name: string;
  specialUse: string | null;
  unseen: number;
};

export type MailListItem = {
  uid: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
};

export type MailAttachment = {
  index: number;
  filename: string;
  size: number | null;
  contentType: string | null;
};

export type MailFilePayload = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type MailMessage = {
  uid: string;
  folder: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  html: string;
  text: string;
  seen: boolean;
  attachments: MailAttachment[];
};

export type MailListQuery = {
  folder: string;
  page?: number;
  limit?: number;
  search?: string;
};

export type MailListPage = {
  items: MailListItem[];
  total: number;
  page: number;
  limit: number;
};

export type SendMailDto = {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachments?: MailFilePayload[];
};

export type ReplyMailDto = {
  folder: string;
  bodyHtml: string;
  bodyText: string;
  attachments?: MailFilePayload[];
};

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const name = asString(o.name ?? o.personal);
    const email = asString(o.email ?? o.address ?? o.addr);
    if (name && email) return `${name} <${email}>`;
    return email || name;
  }
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function pickList(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(o[key])) return o[key] as unknown[];
  }
  return [];
}

function normalizeFolder(raw: unknown): MailFolder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o.path ?? o.id ?? o.folder ?? o.name ?? o.mailbox);
  if (!id) return null;
  const unseen =
    asNumber(o.unseen ?? o.unseenCount ?? o.unread ?? o.unreadCount) ?? 0;
  return {
    id,
    name: asString(o.name ?? o.label) || id,
    specialUse: asString(o.specialUse ?? o.special_use ?? o.attrib) || null,
    unseen,
  };
}

function normalizeListItem(raw: unknown): MailListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const uid = asString(o.uid ?? o.id);
  if (!uid) return null;
  const flags = Array.isArray(o.flags) ? o.flags.map((f) => String(f).toLowerCase()) : [];
  const seen =
    o.seen === true ||
    o.isRead === true ||
    o.read === true ||
    flags.some((f) => f.includes("seen"));
  const attachments = o.attachments ?? o.attachment;
  const hasAttachments =
    o.hasAttachments === true ||
    o.has_attachments === true ||
    (Array.isArray(attachments) && attachments.length > 0);
  const flagged =
    o.flagged === true ||
    o.starred === true ||
    o.isStarred === true ||
    flags.some((f) => f.includes("flag") || f.includes("star"));
  return {
    uid,
    from: asString(o.from ?? o.sender ?? o.fromAddress ?? o.from_address) || "—",
    subject: asString(o.subject) || "(sans objet)",
    snippet: asString(o.snippet ?? o.preview ?? o.textPreview ?? o.text_preview),
    date: asString(o.date ?? o.sentAt ?? o.sent_at ?? o.internalDate ?? o.createdAt ?? o.created_at),
    seen: o.seen === false || o.unread === true ? false : seen,
    flagged,
    hasAttachments,
  };
}

function normalizeAttachment(raw: unknown, fallbackIndex: number): MailAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const index = asNumber(o.index ?? o.partIndex ?? o.part_index ?? o.part) ?? fallbackIndex;
  const filename =
    asString(o.filename ?? o.fileName ?? o.name ?? o.file_name) || `piece-jointe-${index + 1}`;
  return {
    index,
    filename,
    size: asNumber(o.size ?? o.fileSize ?? o.file_size),
    contentType: asString(o.contentType ?? o.content_type ?? o.mimeType ?? o.mime) || null,
  };
}

function normalizeMessage(raw: unknown, fallbackFolder: string): MailMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const nested = root.message ?? root.item;
  const o =
    nested && typeof nested === "object" ? (nested as Record<string, unknown>) : root;
  const uid = asString(o.uid ?? o.id);
  if (!uid) return null;
  const attachments = (Array.isArray(o.attachments) ? o.attachments : [])
    .map((item, index) => normalizeAttachment(item, index))
    .filter((a): a is MailAttachment => Boolean(a));
  const flags = Array.isArray(o.flags) ? o.flags.map((f) => String(f).toLowerCase()) : [];
  const seen = o.seen === false ? false : o.seen === true || flags.some((f) => f.includes("seen"));
  return {
    uid,
    folder: asString(o.folder) || fallbackFolder,
    from: asString(o.from ?? o.sender) || "—",
    to: asString(o.to ?? o.recipients),
    cc: asString(o.cc),
    subject: asString(o.subject) || "(sans objet)",
    date: asString(o.date ?? o.sentAt ?? o.sent_at ?? o.internalDate),
    html: asString(o.html ?? o.bodyHtml ?? o.body_html),
    text: asString(o.text ?? o.bodyText ?? o.body_text ?? o.body),
    seen,
    attachments,
  };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function isMailboxDisconnected(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status !== 409) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("boîte mail") || msg.includes("boite mail") || msg.includes("non connect");
}

export async function listFolders(): Promise<MailFolder[]> {
  const raw = await api.get<unknown>("/me/mail/folders");
  return pickList(raw, ["folders", "items", "mailboxes"])
    .map(normalizeFolder)
    .filter((f): f is MailFolder => Boolean(f));
}

export async function listMessages(query: MailListQuery): Promise<MailListPage> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const raw = await api.get<unknown>(
    `/me/mail/messages${buildQuery({
      folder: query.folder,
      page,
      limit,
      search: query.search?.trim() || undefined,
    })}`,
  );
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items = pickList(raw, ["items", "messages", "emails"])
    .map(normalizeListItem)
    .filter((m): m is MailListItem => Boolean(m));
  const total = asNumber(o.total ?? o.count) ?? items.length;
  return {
    items,
    total,
    page: asNumber(o.page) ?? page,
    limit: asNumber(o.limit) ?? limit,
  };
}

export async function getMessage(uid: string, folder: string): Promise<MailMessage> {
  const raw = await api.get<unknown>(
    `/me/mail/messages/${encodeURIComponent(uid)}${buildQuery({ folder })}`,
  );
  const message = normalizeMessage(raw, folder);
  if (!message) throw new ApiError("Message introuvable.", 404);
  return message;
}

export function markSeen(uid: string, folder: string) {
  return api.post<unknown>(`/me/mail/messages/${encodeURIComponent(uid)}/seen`, { folder });
}

export function sendMail(dto: SendMailDto) {
  return api.post<unknown>("/me/mail/send", dto);
}

export function replyMail(uid: string, dto: ReplyMailDto) {
  return api.post<unknown>(`/me/mail/messages/${encodeURIComponent(uid)}/reply`, dto);
}

function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
  if (Array.isArray(obj.message)) return obj.message.map(String).join(", ");
  if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
  return fallback;
}

/** GET authentifié (Bearer JWT) renvoyé en blob, puis téléchargement navigateur. */
export async function downloadAttachment(uid: string, folder: string, index: number, filename: string): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const path = `/me/mail/messages/${encodeURIComponent(uid)}/attachment${buildQuery({ folder, index })}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method: "GET", headers });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion ou l’API.", 0);
  }

  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    throw new ApiError("Session expirée. Veuillez vous reconnecter.", 401);
  }

  if (!res.ok) {
    const text = await res.text();
    let data: unknown = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    throw new ApiError(errorMessage(data, "Téléchargement impossible."), res.status, data);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "piece-jointe";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
