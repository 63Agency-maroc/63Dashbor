import { api, ApiError } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";
import { getToken } from "@/lib/auth/storage";

export type WhatsappConversation = {
  id: string;
  phoneNumber: string;
  contactName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: string | null;
  source: string | null;
};

export type MessageDirection = "inbound" | "outbound";
export type MessageType = "text" | "image" | "video" | "document" | "audio" | "template";
export type MessageStatus = "sent" | "delivered" | "read" | "failed" | string;

export type WhatsappReplyTo = {
  id: string;
  body: string | null;
  authorLabel: string | null;
} | null;

export type WhatsappMessage = {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  body: string | null;
  type: MessageType | string;
  mediaId: string | null;
  mediaUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  status: MessageStatus;
  watiMessageId: string | null;
  metaMessageId: string | null;
  createdAt: string;
  replyTo: WhatsappReplyTo;
};

export type MessagesPage = {
  items: WhatsappMessage[];
  olderCursor: string | null;
  hasMore: boolean;
  /** Legacy — ne pas utiliser pour le scroll up */
  nextCursor?: string | null;
};

/**
 * Curseur d’historique = base64url renvoyé par l’API.
 * Refuse les UUID bruts (id message/conversation) qui provoquent 409 côté PG.
 */
export function isWhatsappPaginationCursor(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  const t = value.trim();
  if (t.length < 8) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    return false;
  }
  // base64 / base64url
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(t);
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/** Liste brute (pas { items }) */
export function getConversations() {
  return api.get<WhatsappConversation[]>("/whatsapp/conversations");
}

export function getConversation(id: string) {
  return api.get<WhatsappConversation>(`/whatsapp/conversations/${id}`);
}

function asTrimmedString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Normalise un message API (camelCase / snake_case) pour le rendu bulles */
export function normalizeWhatsappMessage(raw: unknown): WhatsappMessage {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const type = asTrimmedString(m.type ?? m.messageType ?? m.message_type) ?? "text";
  return {
    id: String(m.id ?? ""),
    conversationId: String(m.conversationId ?? m.conversation_id ?? ""),
    direction: (asTrimmedString(m.direction) as WhatsappMessage["direction"]) || "inbound",
    body: asTrimmedString(m.body),
    type,
    mediaId: asTrimmedString(m.mediaId ?? m.media_id),
    mediaUrl: asTrimmedString(m.mediaUrl ?? m.media_url),
    fileName: asTrimmedString(m.fileName ?? m.file_name),
    fileSize: typeof m.fileSize === "number" ? m.fileSize : typeof m.file_size === "number" ? m.file_size : null,
    status: (asTrimmedString(m.status) as WhatsappMessage["status"]) || "sent",
    watiMessageId: asTrimmedString(m.watiMessageId ?? m.wati_message_id),
    metaMessageId: asTrimmedString(m.metaMessageId ?? m.meta_message_id),
    createdAt: String(m.createdAt ?? m.created_at ?? ""),
    replyTo: (m.replyTo ?? m.reply_to ?? null) as WhatsappMessage["replyTo"],
  };
}

function normalizeMessagesPage(page: MessagesPage): MessagesPage {
  const items = Array.isArray(page?.items) ? page.items.map(normalizeWhatsappMessage) : [];
  return {
    ...page,
    items,
    olderCursor: page?.olderCursor ?? null,
    hasMore: Boolean(page?.hasMore),
  };
}

/**
 * Messages d’une conversation.
 * - Ouverture : { direction: "latest", limit } — PAS de before/cursor
 * - Historique : { before: olderCursor, limit } — olderCursor tel que renvoyé (base64url)
 */
export async function getMessages(
  conversationId: string,
  params: { direction?: "latest"; before?: string; limit?: number } = {},
): Promise<MessagesPage> {
  const limit = params.limit ?? 50;
  const before = params.before?.trim();

  let page: MessagesPage;
  if (before) {
    if (!isWhatsappPaginationCursor(before)) {
      throw new ApiError("Curseur d’historique invalide (UUID brut refusé).", 400);
    }
    page = await api.get<MessagesPage>(
      `/whatsapp/conversations/${conversationId}/messages${buildQuery({
        before,
        limit,
      })}`,
    );
  } else {
    page = await api.get<MessagesPage>(
      `/whatsapp/conversations/${conversationId}/messages${buildQuery({
        direction: params.direction ?? "latest",
        limit,
      })}`,
    );
  }
  return normalizeMessagesPage(page);
}

export type WhatsappTemplate = {
  id: string;
  name: string;
  body: string;
  language: string;
  type: string;
  status: string;
};

export type SendTextDto = {
  text: string;
  replyToMessageId?: string;
};

export type SendMediaDto = {
  type: "image" | "video" | "document";
  mediaUrl: string;
  text?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  replyToMessageId?: string;
};

export type SendMessageDto = SendTextDto | SendMediaDto;

export type SendTemplateDto = {
  templateName: string;
  templateLanguage?: string;
  variable1?: string;
};

export type MediaMeta = {
  url: string;
  mimeType: string;
};

export async function sendMessage(conversationId: string, dto: SendMessageDto) {
  const created = await api.post<WhatsappMessage>(
    `/whatsapp/conversations/${conversationId}/messages`,
    dto,
  );
  return normalizeWhatsappMessage(created);
}

export async function sendTemplate(conversationId: string, dto: SendTemplateDto) {
  const created = await api.post<WhatsappMessage>(
    `/whatsapp/conversations/${conversationId}/messages/template`,
    dto,
  );
  return normalizeWhatsappMessage(created);
}

export function markRead(conversationId: string) {
  return api.patch<WhatsappConversation>(`/whatsapp/conversations/${conversationId}/read`);
}

export function getTemplates() {
  return api.get<{ templates: WhatsappTemplate[] }>("/whatsapp/templates");
}

export function getMediaMeta(mediaId: string) {
  return api.get<MediaMeta>(`/whatsapp/media/${mediaId}`);
}

/** Audio/blob sécurisé (JWT) → Blob pour <audio> */
export async function fetchMediaContentBlob(mediaId: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/whatsapp/media/${encodeURIComponent(mediaId)}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new ApiError(`Média indisponible (${res.status})`, res.status);
  }
  return res.blob();
}

export type MessageStatusEvent = {
  id?: string;
  watiMessageId?: string | null;
  conversationId: string;
  status: MessageStatus;
};

/** Détecte l'erreur fenêtre 24h Meta */
export function isWhatsapp24hError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  const blob = `${err.message} ${typeof err.body === "string" ? err.body : JSON.stringify(err.body ?? "")}`;
  return /24\s*h|131047|131026|outside.*(window|session)/i.test(blob);
}
