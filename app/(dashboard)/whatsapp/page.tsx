"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { ApiError } from "@/lib/api/client";
import { mediaTypeForUpload, uploadFile, uploadKindForFile } from "@/lib/api/upload";
import {
  getConversations,
  getMessages,
  getTemplates,
  isWhatsapp24hError,
  isWhatsappPaginationCursor,
  markRead,
  normalizeWhatsappMessage,
  sendMessage,
  sendTemplate,
  type MessageStatusEvent,
  type WhatsappConversation,
  type WhatsappMessage,
  type WhatsappTemplate,
} from "@/lib/api/whatsapp";
import { formatInCasablanca, parseIso } from "@/lib/datetime/casablanca";
import { getSocket } from "@/lib/realtime/socket";
import { WhatsappMessageBubble } from "@/components/whatsapp/WhatsappMessageBubble";
import { AppToast } from "@/components/clients/AppToast";
import { Select } from "@/components/ui/Select";

function displayName(c: WhatsappConversation) {
  return (c.contactName || "").trim() || c.phoneNumber || "Contact";
}

function initials(c: WhatsappConversation) {
  const n = displayName(c);
  return n.charAt(0).toUpperCase() || "?";
}

function sortConversations(list: WhatsappConversation[]) {
  return [...list].sort((a, b) => {
    const ta = parseIso(a.lastMessageAt)?.getTime() ?? 0;
    const tb = parseIso(b.lastMessageAt)?.getTime() ?? 0;
    return tb - ta;
  });
}

function upsertById(list: WhatsappMessage[], msg: WhatsappMessage): WhatsappMessage[] {
  const idx = list.findIndex((m) => m.id === msg.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...msg };
    return next;
  }
  return [...list, msg];
}

function mergeStatus(list: WhatsappMessage[], ev: MessageStatusEvent): WhatsappMessage[] {
  return list.map((m) => {
    const byId = ev.id && m.id === ev.id;
    const byWati = ev.watiMessageId && m.watiMessageId === ev.watiMessageId;
    if (byId || byWati) return { ...m, status: ev.status };
    return m;
  });
}

export default function WhatsappPage() {
  const { user } = useAuth();
  const { connected: liveConnected } = useRealtime();
  const role = user?.role ?? "";
  const allowed = role === "admin" || role === "admin_whatsapp";

  const [forbidden, setForbidden] = useState(false);
  const [conversations, setConversations] = useState<WhatsappConversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<WhatsappMessage | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);

  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [showTemplate, setShowTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLang, setTemplateLang] = useState("");
  const [variable1, setVariable1] = useState("");
  const [window24hHint, setWindow24hHint] = useState(false);

  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" | "info" } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pendingNewCount, setPendingNewCount] = useState(0);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const activeIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Empêche loadOlder pendant ouverture / avant scroll bas initial */
  const historyReadyRef = useRef(false);
  const openSeqRef = useRef(0);
  const olderCursorRef = useRef<string | null>(null);

  activeIdRef.current = activeId;
  olderCursorRef.current = olderCursor;

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = `${c.contactName ?? ""} ${c.phoneNumber ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, search]);

  const loadConversations = useCallback(async () => {
    if (!allowed) {
      setForbidden(true);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    setListError(null);
    try {
      const list = await getConversations();
      setConversations(sortConversations(Array.isArray(list) ? list : []));
      setForbidden(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setConversations([]);
        return;
      }
      setListError(err instanceof ApiError ? err.message : "Impossible de charger les conversations.");
    } finally {
      setListLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const normalizeCursor = useCallback((raw: string | null | undefined): string | null => {
    if (!isWhatsappPaginationCursor(raw)) return null;
    return raw.trim();
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      const seq = ++openSeqRef.current;
      historyReadyRef.current = false;
      setActiveId(id);
      setMobileSidebarOpen(false);
      setMessages([]);
      setOlderCursor(null);
      olderCursorRef.current = null;
      setHasMore(false);
      setMsgError(null);
      setReplyTo(null);
      setWindow24hHint(false);
      setShowTemplate(false);
      setPendingNewCount(0);
      setMsgLoading(true);
      stickToBottomRef.current = true;

      try {
        // Ouverture : UNIQUEMENT direction=latest (pas de before/cursor)
        const page = await getMessages(id, { direction: "latest", limit: 50 });
        if (seq !== openSeqRef.current) return;

        const items = Array.isArray(page.items) ? page.items : [];
        const cursor = normalizeCursor(page.olderCursor);
        setMessages(items);
        setOlderCursor(cursor);
        olderCursorRef.current = cursor;
        setHasMore(Boolean(page.hasMore && cursor));

        // Scroll bas après paint (messages récents visibles)
        requestAnimationFrame(() => {
          scrollToBottom(false);
          requestAnimationFrame(() => {
            scrollToBottom(false);
            historyReadyRef.current = true;
          });
        });

        try {
          const updated = await markRead(id);
          if (seq !== openSeqRef.current) return;
          setConversations((prev) =>
            sortConversations(prev.map((c) => (c.id === id ? { ...c, ...updated, unreadCount: 0 } : c))),
          );
        } catch {
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
          );
        }
      } catch (err) {
        if (seq !== openSeqRef.current) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          return;
        }
        setMsgError(err instanceof ApiError ? err.message : "Impossible de charger les messages.");
      } finally {
        if (seq === openSeqRef.current) setMsgLoading(false);
      }
    },
    [scrollToBottom, normalizeCursor],
  );

  const loadOlder = useCallback(async () => {
    const convId = activeIdRef.current;
    const cursor = normalizeCursor(olderCursorRef.current);
    if (!convId || !cursor || loadingOlder || !hasMore || !historyReadyRef.current) return;

    const el = chatScrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      // Historique : UNIQUEMENT before=<olderCursor> (pas de direction=latest)
      const page = await getMessages(convId, { before: cursor, limit: 50 });
      if (activeIdRef.current !== convId) return;

      const older = Array.isArray(page.items) ? page.items : [];
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const unique = older.filter((m) => !ids.has(m.id));
        return [...unique, ...prev];
      });
      const nextCursor = normalizeCursor(page.olderCursor);
      setOlderCursor(nextCursor);
      olderCursorRef.current = nextCursor;
      setHasMore(Boolean(page.hasMore && nextCursor));
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = el.scrollHeight - prevHeight + prevTop;
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 409)) {
        // curseur invalide / conflit UUID — stop pagination
        setHasMore(false);
        setOlderCursor(null);
        olderCursorRef.current = null;
        return;
      }
      setToast({
        message: err instanceof ApiError ? err.message : "Historique indisponible.",
        variant: "danger",
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore, normalizeCursor]);

  function onChatScroll() {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) setPendingNewCount(0);
    // Ne charger l’historique qu’après ouverture stabilisée + curseur valide
    if (historyReadyRef.current && el.scrollTop < 48) {
      void loadOlder();
    }
  }

  function jumpToLatest() {
    setPendingNewCount(0);
    stickToBottomRef.current = true;
    scrollToBottom(true);
  }

  // Garde le bas visible (ouverture + live) sans interférer avec le préfixe historique
  useEffect(() => {
    if (!activeId || msgLoading || loadingOlder) return;
    if (!stickToBottomRef.current) return;
    requestAnimationFrame(() => scrollToBottom(false));
  }, [messages, msgLoading, loadingOlder, activeId, scrollToBottom]);

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    if (!activeId || sending) return;
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setWindow24hHint(false);
    try {
      const created = await sendMessage(activeId, {
        text,
        replyToMessageId: replyTo?.id,
      });
      setMessages((prev) => upsertById(prev, created));
      setDraft("");
      setReplyTo(null);
      stickToBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(true));
      setConversations((prev) =>
        sortConversations(
          prev.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  lastMessageText: text,
                  lastMessageAt: created.createdAt,
                }
              : c,
          ),
        ),
      );
    } catch (err) {
      if (isWhatsapp24hError(err)) {
        setWindow24hHint(true);
        setShowTemplate(true);
        void ensureTemplates();
        setToast({
          message: "Fenêtre 24h fermée — utilisez un template WhatsApp.",
          variant: "info",
        });
      } else {
        setToast({
          message: err instanceof ApiError ? err.message : "Envoi impossible.",
          variant: "danger",
        });
      }
    } finally {
      setSending(false);
    }
  }

  async function ensureTemplates() {
    if (templates.length) return;
    try {
      const res = await getTemplates();
      const list = Array.isArray(res.templates) ? res.templates : [];
      setTemplates(list);
      if (list[0]) {
        setTemplateName(list[0].name);
        setTemplateLang(list[0].language || "");
      }
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Templates indisponibles.",
        variant: "danger",
      });
    }
  }

  async function handleSendTemplate(e: FormEvent) {
    e.preventDefault();
    if (!activeId || !templateName || sending) return;
    setSending(true);
    try {
      const created = await sendTemplate(activeId, {
        templateName,
        templateLanguage: templateLang || undefined,
        variable1: variable1.trim() || undefined,
      });
      setMessages((prev) => upsertById(prev, created));
      setShowTemplate(false);
      setWindow24hHint(false);
      setVariable1("");
      stickToBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(true));
      setToast({ message: "Template envoyé.", variant: "success" });
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Envoi template impossible.",
        variant: "danger",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleAttach(file: File) {
    if (!activeId || attachBusy) return;
    setAttachBusy(true);
    setWindow24hHint(false);
    try {
      const kind = uploadKindForFile(file);
      const uploaded = await uploadFile(file, kind);
      const type = mediaTypeForUpload(kind);
      const created = await sendMessage(activeId, {
        type,
        mediaUrl: uploaded.url,
        text: draft.trim() || undefined,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
        replyToMessageId: replyTo?.id,
      });
      setMessages((prev) => upsertById(prev, created));
      setDraft("");
      setReplyTo(null);
      stickToBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (err) {
      if (isWhatsapp24hError(err)) {
        setWindow24hHint(true);
        setShowTemplate(true);
        void ensureTemplates();
        setToast({
          message: "Fenêtre 24h fermée — utilisez un template WhatsApp.",
          variant: "info",
        });
      } else {
        setToast({
          message: err instanceof ApiError ? err.message : "Pièce jointe impossible.",
          variant: "danger",
        });
      }
    } finally {
      setAttachBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Realtime
  useEffect(() => {
    if (forbidden || !allowed) return;
    let socket;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onMessageCreated = (msgRaw: WhatsappMessage) => {
      const msg = normalizeWhatsappMessage(msgRaw);
      if (!msg?.id || !msg.conversationId) return;
      const openId = activeIdRef.current;

      if (openId && msg.conversationId === openId) {
        setMessages((prev) => upsertById(prev, msg));
        if (stickToBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        } else {
          setPendingNewCount((n) => n + 1);
        }
        void markRead(openId).then((updated) => {
          setConversations((prev) =>
            sortConversations(prev.map((c) => (c.id === openId ? { ...c, ...updated, unreadCount: 0 } : c))),
          );
        }).catch(() => undefined);
      }

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === msg.conversationId);
        let next = exists
          ? prev.map((c) => {
              if (c.id !== msg.conversationId) return c;
              const bumpUnread =
                msg.direction === "inbound" && openId !== msg.conversationId
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount;
              return {
                ...c,
                lastMessageText: msg.body || c.lastMessageText,
                lastMessageAt: msg.createdAt,
                unreadCount: bumpUnread,
              };
            })
          : prev;
        if (!exists) {
          // conversation inconnue — recharger la liste plus tard
          void loadConversations();
          return prev;
        }
        return sortConversations(next);
      });
    };

    const onConversationUpdated = (conv: WhatsappConversation) => {
      if (!conv?.id) return;
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        const next = exists
          ? prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c))
          : [conv, ...prev];
        return sortConversations(next);
      });
    };

    const onMessageStatus = (ev: MessageStatusEvent) => {
      if (!ev?.conversationId) return;
      if (activeIdRef.current === ev.conversationId) {
        setMessages((prev) => mergeStatus(prev, ev));
      }
    };

    socket.on("message:created", onMessageCreated);
    socket.on("conversation:updated", onConversationUpdated);
    socket.on("message:status", onMessageStatus);

    return () => {
      socket.off("message:created", onMessageCreated);
      socket.off("conversation:updated", onConversationUpdated);
      socket.off("message:status", onMessageStatus);
    };
  }, [forbidden, allowed, scrollToBottom, loadConversations]);

  if (!allowed || forbidden) {
    return (
      <div className="container-fluid">
        <div className="app-page-head">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <a href="/">
                  <i className="fi fi-rr-home" /> Home
                </a>
              </li>
              <li className="breadcrumb-item active">WhatsApp</li>
            </ol>
          </nav>
        </div>
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="avatar avatar-lg bg-warning-subtle text-warning rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
              <i className="fi fi-rr-lock scale-2x" />
            </div>
            <h5 className="mb-2">Accès non autorisé</h5>
            <p className="text-muted mb-0">Votre rôle ne permet pas d’accéder à WhatsApp.</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedTemplate = templates.find((t) => t.name === templateName);
  const needsVar1 = Boolean(selectedTemplate?.body?.includes("{{1}}"));

  return (
    <div className="container-fluid whatsapp-page">
      <style>{`
        .whatsapp-page .chat-wrapper {
          height: calc(100vh - var(--app-header-height, 70px) - var(--footer-height, 56px) - 110px);
          min-height: 420px;
          max-height: calc(100vh - var(--app-header-height, 70px) - var(--footer-height, 56px) - 110px);
        }
        .whatsapp-page .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }
        .whatsapp-page .chat-header {
          flex-shrink: 0;
        }
        .whatsapp-page .chat-body {
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-height: 0;
          height: auto !important;
          overflow: hidden;
        }
        .whatsapp-page .wa-jump-latest {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 5;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }
        .whatsapp-page .chat-conversation {
          flex: 1 1 auto;
          min-height: 0;
          height: auto !important;
          max-height: none !important;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding-top: 12px !important;
          padding-bottom: 12px !important;
        }
        .whatsapp-page .chat-conversation .chat-message-left,
        .whatsapp-page .chat-conversation .chat-message-right {
          max-width: 68%;
          gap: 2px;
          margin-bottom: 4px;
        }
        .whatsapp-page .chat-conversation .chat-message-left + .chat-message-right,
        .whatsapp-page .chat-conversation .chat-message-right + .chat-message-left {
          margin-top: 8px;
        }
        .whatsapp-page .chat-conversation .chat-message-text {
          padding: 6px 10px;
          font-size: 0.875rem;
          line-height: 1.35;
          border-radius: 8px;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04);
        }
        .whatsapp-page .chat-conversation .chat-message-left .chat-message-text {
          border-radius: 2px 8px 8px 8px;
        }
        .whatsapp-page .chat-conversation .chat-message-right .chat-message-text {
          border-radius: 8px 2px 8px 8px;
        }
        .whatsapp-page .chat-conversation .chat-message-text:first-child,
        .whatsapp-page .chat-conversation .chat-message-text:nth-last-child(2) {
          border-radius: inherit;
        }
        .whatsapp-page .chat-conversation .chat-message-left .chat-message-text:first-child {
          border-radius: 2px 8px 8px 8px;
        }
        .whatsapp-page .chat-conversation .chat-message-right .chat-message-text:first-child {
          border-radius: 8px 2px 8px 8px;
        }
        .whatsapp-page .chat-conversation .wa-reply-quote {
          font-size: 0.75rem;
          line-height: 1.25;
          padding: 4px 8px !important;
          max-width: 100%;
          opacity: 0.85;
          margin-bottom: 0 !important;
        }
        .whatsapp-page .chat-conversation .chat-time {
          font-size: 0.7rem;
          line-height: 1.2;
          opacity: 0.75;
          margin-top: 1px;
        }
        .whatsapp-page .chat-conversation .chat-time i {
          font-size: 0.75rem;
        }
        .whatsapp-page .chat-conversation .chat-time .btn-link {
          font-size: 0.7rem;
          line-height: 1;
          opacity: 0.6;
        }
        .whatsapp-page .chat-conversation .wa-media img,
        .whatsapp-page .chat-conversation .wa-media video,
        .whatsapp-page .chat-conversation video.wa-media {
          max-width: 220px;
          border-radius: 6px;
          display: block;
        }
        .whatsapp-page .chat-conversation .wa-media {
          margin-bottom: 4px !important;
        }
        .whatsapp-page .chat-conversation .wa-audio-wrap {
          display: block;
          min-width: 220px;
          max-width: 280px;
        }
        .whatsapp-page .chat-conversation .wa-voice {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 220px;
          max-width: 280px;
          user-select: none;
        }
        .whatsapp-page .chat-conversation .wa-voice audio {
          display: none;
        }
        .whatsapp-page .chat-conversation .wa-voice-play {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          transition: transform 0.12s ease, opacity 0.12s ease, background-color 0.2s ease;
        }
        .whatsapp-page .chat-conversation .wa-voice-play:hover {
          opacity: 0.92;
        }
        .whatsapp-page .chat-conversation .wa-voice-play:active {
          transform: scale(0.96);
        }
        .whatsapp-page .chat-conversation .wa-voice-play i {
          font-size: 16px;
          margin-left: 1px;
        }
        .whatsapp-page .chat-conversation .wa-voice-play .fi-rr-pause {
          margin-left: 0;
        }
        /* Inbound : couleurs du thème */
        .whatsapp-page .chat-conversation .wa-voice--in .wa-voice-play {
          background: var(--bs-primary);
          color: #fff;
        }
        /* Outbound : bouton clair sur bulle primaire */
        .whatsapp-page .chat-conversation .wa-voice--out .wa-voice-play {
          background: rgba(255, 255, 255, 0.95);
          color: var(--bs-primary);
        }
        .whatsapp-page .chat-conversation .wa-voice-body {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-top: 2px;
        }
        .whatsapp-page .chat-conversation .wa-voice-wave {
          position: relative;
          height: 28px;
          cursor: pointer;
          overflow: hidden;
        }
        .whatsapp-page .chat-conversation .wa-voice-wave-track,
        .whatsapp-page .chat-conversation .wa-voice-wave-fill {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 100%;
        }
        .whatsapp-page .chat-conversation .wa-voice-wave-fill {
          position: absolute;
          left: 0;
          top: 0;
          overflow: hidden;
          width: 0;
          pointer-events: none;
          /* progression fluide pendant la lecture */
          transition: width 0.2s linear;
        }
        .whatsapp-page .chat-conversation .wa-voice-wave.is-playing .wa-voice-wave-fill {
          transition: width 0.12s linear;
        }
        .whatsapp-page .chat-conversation .wa-voice-bar {
          width: 3px;
          border-radius: 2px;
          flex-shrink: 0;
          display: block;
        }
        .whatsapp-page .chat-conversation .wa-voice--in .wa-voice-wave-track .wa-voice-bar {
          background: color-mix(in srgb, var(--bs-primary) 28%, transparent);
        }
        .whatsapp-page .chat-conversation .wa-voice--in .wa-voice-wave-fill .wa-voice-bar {
          background: var(--bs-primary);
        }
        .whatsapp-page .chat-conversation .wa-voice--out .wa-voice-wave-track .wa-voice-bar {
          background: rgba(255, 255, 255, 0.35);
        }
        .whatsapp-page .chat-conversation .wa-voice--out .wa-voice-wave-fill .wa-voice-bar {
          background: #fff;
        }
        .whatsapp-page .chat-conversation .wa-voice-meta {
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }
        .whatsapp-page .chat-conversation .wa-voice-time {
          font-size: 0.7rem;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          color: var(--bs-secondary-color, var(--bs-secondary));
          opacity: 0.85;
        }
        .whatsapp-page .chat-conversation .wa-voice--out .wa-voice-time {
          color: rgba(255, 255, 255, 0.9);
          opacity: 1;
        }
        .whatsapp-page .chat-conversation .wa-voice-mic {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          align-self: flex-end;
          margin-bottom: 2px;
          position: relative;
        }
        .whatsapp-page .chat-conversation .wa-voice-mic i {
          font-size: 14px;
        }
        .whatsapp-page .chat-conversation .wa-voice--in .wa-voice-mic {
          background: color-mix(in srgb, var(--bs-primary) 16%, var(--bs-body-bg));
          color: var(--bs-primary);
        }
        .whatsapp-page .chat-conversation .wa-voice--out .wa-voice-mic {
          background: rgba(255, 255, 255, 0.22);
          color: #fff;
        }
        .whatsapp-page .chat-conversation .wa-voice-mic::after {
          content: "";
          position: absolute;
          right: -1px;
          bottom: -1px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--bs-primary);
          border: 1.5px solid var(--bs-body-bg);
        }
        .whatsapp-page .chat-conversation .chat-message-right .wa-voice-mic::after {
          border-color: var(--bs-primary);
          background: #fff;
        }
        .whatsapp-page .chat-composer {
          flex-shrink: 0;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background-color: var(--bs-body-bg);
        }
        .whatsapp-page .chat-sidebar {
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .whatsapp-page .chat-nav {
          flex: 1 1 auto;
          min-height: 0;
          height: auto !important;
          overflow-y: auto;
        }
      `}</style>
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex flex-wrap gap-3 align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              WhatsApp
            </li>
          </ol>
        </nav>
        <div className="d-flex align-items-center gap-2">
          <a href="/whatsapp/broadcast" className="btn btn-sm btn-primary">
            <i className="fi fi-rr-paper-plane me-1" />
            Broadcast
          </a>
          <span
            className="d-inline-flex align-items-center gap-1 small text-muted"
            title={liveConnected ? "Temps réel connecté" : "Hors ligne"}
          >
            <span
              className="rounded-circle d-inline-block"
              style={{
                width: 8,
                height: 8,
                backgroundColor: liveConnected ? "#22c55e" : "#9ca3af",
              }}
            />
            {liveConnected ? "live" : "hors ligne"}
          </span>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card card-body overflow-hidden chat-wrapper p-0">
            <div
              className={`sidebar-mobile-overlay${mobileSidebarOpen ? " show" : ""}`}
              onClick={() => setMobileSidebarOpen(false)}
              role="presentation"
            />

            {/* LISTE */}
            <div className={`chat-sidebar${mobileSidebarOpen ? " open" : ""}`}>
              <div className="d-flex p-3 align-items-center justify-content-between flex-shrink-0">
                <form
                  className="d-flex align-items-center shadow-sm position-relative w-100 app-search-field"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <button type="button" className="btn btn-sm border-0 position-absolute start-0 ms-3 p-0">
                    <i className="fi fi-rr-search" />
                  </button>
                  <input
                    type="search"
                    className="form-control ps-5"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </form>
                <button
                  type="button"
                  className="btn btn-sm btn-shadow btn-icon ms-2 btn-close d-inline-flex d-lg-none"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <i className="fi fi-sr-cross" />
                </button>
              </div>

              <div className="chat-nav" role="tablist">
                {listLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" />
                  </div>
                ) : listError ? (
                  <div className="p-3">
                    <div className="alert alert-danger mb-2 py-2 small">{listError}</div>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void loadConversations()}>
                      Réessayer
                    </button>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-3 text-muted small">Aucune conversation</div>
                ) : (
                  filteredConversations.map((c) => (
                    <a
                      key={c.id}
                      href="#"
                      className={`chat-nav-item${activeId === c.id ? " active" : ""}`}
                      onClick={(e) => {
                        e.preventDefault();
                        void openConversation(c.id);
                      }}
                    >
                      <div className="avatar rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center">
                        {initials(c)}
                      </div>
                      <div className="chat-avatar-info">
                        <div className="clearfix">
                          <h6 className="name">{displayName(c)}</h6>
                          <span className="text text-truncate d-block" style={{ maxWidth: 140 }}>
                            {c.lastMessageText || "—"}
                          </span>
                        </div>
                        <div className="text-end">
                          <small className="time">
                            {c.lastMessageAt
                              ? formatInCasablanca(c.lastMessageAt, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </small>
                          {c.unreadCount > 0 ? (
                            <span className="badge badge-sm rounded-pill bg-primary">{c.unreadCount}</span>
                          ) : null}
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>

            {/* CHAT */}
            <div className="chat-container">
              {activeConv ? (
                <>
                  <div className="chat-header">
                    <div className="d-flex align-items-center">
                      <button
                        type="button"
                        className="btn btn-white btn-shadow btn-icon waves-effect chat-sidebar-toggler d-lg-none me-2"
                        onClick={() => setMobileSidebarOpen(true)}
                      >
                        <i className="fi fi-rr-menu-burger" />
                      </button>
                      <a href="#" className="chat-nav-item" onClick={(e) => e.preventDefault()}>
                        <div className="avatar rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center">
                          {initials(activeConv)}
                        </div>
                        <div className="chat-avatar-info">
                          <div className="clearfix">
                            <h6 className="name mb-0">{displayName(activeConv)}</h6>
                            <span className="text small text-muted">{activeConv.phoneNumber}</span>
                          </div>
                        </div>
                      </a>
                    </div>
                    {/* TODO: pas d'API — actions header template (call/video/info) retirées */}
                  </div>

                  <div className="chat-body">
                    <div className="chat-conversation px-3" ref={chatScrollRef} onScroll={onChatScroll}>
                      {loadingOlder ? (
                        <div className="text-center py-2">
                          <div className="spinner-border spinner-border-sm text-muted" />
                        </div>
                      ) : null}
                      {msgLoading ? (
                        <div className="text-center py-5">
                          <div className="spinner-border text-primary" />
                        </div>
                      ) : msgError ? (
                        <div className="alert alert-danger m-3">{msgError}</div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-muted py-5">Aucun message</div>
                      ) : (
                        messages.map((m) => (
                          <WhatsappMessageBubble key={m.id} message={m} onReply={setReplyTo} />
                        ))
                      )}
                    </div>

                    {pendingNewCount > 0 ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary wa-jump-latest"
                        onClick={jumpToLatest}
                      >
                        ↓ {pendingNewCount === 1 ? "1 nouveau" : `${pendingNewCount} nouveaux`}
                      </button>
                    ) : null}

                    <div className="chat-composer">
                      {window24hHint ? (
                        <div className="alert alert-warning mx-3 mb-2 py-2 small">
                          Hors session 24h Meta — envoyez un <strong>template</strong> pour relancer la conversation.
                          <button
                            type="button"
                            className="btn btn-sm btn-warning ms-2"
                            onClick={() => {
                              setShowTemplate(true);
                              void ensureTemplates();
                            }}
                          >
                            Choisir un template
                          </button>
                        </div>
                      ) : null}

                      {replyTo ? (
                        <div className="mx-3 mb-2 px-3 py-2 bg-light rounded d-flex justify-content-between align-items-center gap-2">
                          <div className="small text-truncate">
                            <strong>Reply:</strong> {replyTo.body || `[${replyTo.type}]`}
                          </div>
                          <button type="button" className="btn btn-sm btn-icon" onClick={() => setReplyTo(null)}>
                            <i className="fi fi-rr-cross-small" />
                          </button>
                        </div>
                      ) : null}

                      {showTemplate ? (
                        <form className="mx-3 mb-2 border rounded p-3" onSubmit={(e) => void handleSendTemplate(e)}>
                          <h6 className="mb-2">Envoyer un template</h6>
                          <div className="row g-2">
                            <div className="col-md-6">
                              <Select
                                size="sm"
                                value={templateName}
                                onChange={(v) => {
                                  setTemplateName(v);
                                  const t = templates.find((x) => x.name === v);
                                  if (t) setTemplateLang(t.language || "");
                                }}
                                placeholder="Chargement…"
                                searchable
                                options={
                                  templates.length === 0
                                    ? [{ value: "", label: "Chargement…" }]
                                    : templates.map((t) => ({
                                        value: t.name,
                                        label: `${t.name} (${t.language})`,
                                      }))
                                }
                              />
                            </div>
                            {needsVar1 ? (
                              <div className="col-md-4">
                                <input
                                  className="form-control form-control-sm"
                                  placeholder="variable1 ({{1}})"
                                  value={variable1}
                                  onChange={(e) => setVariable1(e.target.value)}
                                />
                              </div>
                            ) : null}
                            <div className="col-md-2 d-flex gap-1">
                              <button type="submit" className="btn btn-sm btn-primary" disabled={sending || !templateName}>
                                Envoyer
                              </button>
                              <button type="button" className="btn btn-sm btn-light" onClick={() => setShowTemplate(false)}>
                                ×
                              </button>
                            </div>
                          </div>
                          {selectedTemplate?.body ? (
                            <pre className="small text-muted mt-2 mb-0" style={{ whiteSpace: "pre-wrap" }}>
                              {selectedTemplate.body}
                            </pre>
                          ) : null}
                        </form>
                      ) : null}

                      <form className="chat-send-form" onSubmit={(e) => void handleSend(e)}>
                        <input
                          className="form-control chat-input border-0 shadow-none"
                          placeholder="Type message"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          disabled={sending || attachBusy}
                        />
                        <div className="d-flex">
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="d-none"
                            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleAttach(f);
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-action-gray btn-icon waves-effect waves-light me-1"
                            title="Pièce jointe"
                            disabled={sending || attachBusy}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {attachBusy ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <i className="fi fi-rr-add-image" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-action-gray btn-icon waves-effect waves-light me-3"
                            title="Template"
                            onClick={() => {
                              setShowTemplate((v) => !v);
                              void ensureTemplates();
                            }}
                          >
                            <i className="fi fi-rr-file-invoice" />
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary waves-effect waves-light"
                            disabled={sending || !draft.trim()}
                          >
                            {sending ? <span className="spinner-border spinner-border-sm" /> : "Send"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              ) : (
                <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1 py-5 text-muted h-100">
                  <button
                    type="button"
                    className="btn btn-white btn-shadow btn-icon waves-effect chat-sidebar-toggler d-lg-none mb-3"
                    onClick={() => setMobileSidebarOpen(true)}
                  >
                    <i className="fi fi-rr-menu-burger" />
                  </button>
                  <i className="fab fa-whatsapp scale-2x mb-3" />
                  <p className="mb-0">Sélectionnez une conversation</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
