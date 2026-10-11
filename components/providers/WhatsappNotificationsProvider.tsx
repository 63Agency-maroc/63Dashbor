"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApiError } from "@/lib/api/client";
import {
  getConversations,
  getWhatsappUnreadCount,
  normalizeWhatsappConversation,
  normalizeWhatsappMessage,
  type WhatsappConversation,
  type WhatsappMessage,
} from "@/lib/api/whatsapp";
import { playNotifySound, unlockNotifySound } from "@/lib/notifications/notifySound";
import { getSocket } from "@/lib/realtime/socket";

const SOUND_KEY = "wa_notify_sound";
const MAX_ITEMS = 30;

export type WhatsappNotifItem = {
  id: string;
  conversationId: string;
  title: string;
  body: string;
  createdAt: string;
};

type WhatsappNotificationsContextValue = {
  items: WhatsappNotifItem[];
  unreadTotal: number;
  conversationsWithUnread: number;
  loading: boolean;
  available: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setActiveConversationId: (id: string | null) => void;
  refresh: () => Promise<void>;
  dismissItem: (id: string) => void;
  clearItems: () => void;
};

const WhatsappNotificationsContext = createContext<WhatsappNotificationsContextValue | null>(null);

function canAccessWhatsapp(role: string | undefined): boolean {
  return role === "admin" || role === "admin_whatsapp";
}

function previewBody(msg: Pick<WhatsappMessage, "body" | "type">): string {
  const text = msg.body?.trim();
  if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  const t = String(msg.type || "text").toLowerCase();
  if (t === "image") return "📷 Image";
  if (t === "audio") return "🎤 Audio";
  if (t === "video") return "🎬 Vidéo";
  if (t === "document") return "📎 Document";
  if (t === "template") return "Template";
  return "Nouveau message WhatsApp";
}

function convToItem(c: WhatsappConversation): WhatsappNotifItem {
  return {
    id: `conv:${c.id}`,
    conversationId: c.id,
    title: c.contactName?.trim() || c.phoneNumber || "WhatsApp",
    body: c.lastMessageText?.trim() || "Message non lu",
    createdAt: c.lastMessageAt || new Date().toISOString(),
  };
}

function readSoundPref(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(SOUND_KEY);
  if (raw == null) return true;
  return raw !== "0";
}

export function WhatsappNotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const role = typeof user?.role === "string" ? user.role : undefined;
  const allowed = canAccessWhatsapp(role);

  const [items, setItems] = useState<WhatsappNotifItem[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [conversationsWithUnread, setConversationsWithUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [soundEnabled, setSoundEnabledState] = useState(true);

  const activeConversationIdRef = useRef<string | null>(null);
  const convByIdRef = useRef<Map<string, WhatsappConversation>>(new Map());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSoundEnabledState(readSoundPref());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlock = () => unlockNotifySound();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
    }
    if (enabled) unlockNotifySound();
  }, []);

  const setActiveConversationId = useCallback((id: string | null) => {
    activeConversationIdRef.current = id;
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !allowed) {
      setAvailable(false);
      setItems([]);
      setUnreadTotal(0);
      setConversationsWithUnread(0);
      return;
    }

    setLoading(true);
    try {
      const [convs, unread] = await Promise.all([
        getConversations(),
        getWhatsappUnreadCount().catch(() => null),
      ]);
      setAvailable(true);
      const map = new Map<string, WhatsappConversation>();
      for (const c of convs) {
        if (c.id) map.set(c.id, c);
      }
      convByIdRef.current = map;

      const unreadConvs = convs
        .filter((c) => (c.unreadCount || 0) > 0)
        .sort((a, b) => {
          const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
          const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
          return tb - ta;
        })
        .slice(0, MAX_ITEMS)
        .map(convToItem);

      setItems((prev) => {
        // Garde les notifs temps réel récentes qui ne sont pas encore dans unread list
        const fromLive = prev.filter(
          (n) => n.id.startsWith("msg:") && !unreadConvs.some((u) => u.conversationId === n.conversationId),
        );
        const merged = [...fromLive, ...unreadConvs];
        const seen = new Set<string>();
        const out: WhatsappNotifItem[] = [];
        for (const n of merged) {
          const key = n.conversationId;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(n);
          if (out.length >= MAX_ITEMS) break;
        }
        return out;
      });

      if (unread) {
        setUnreadTotal(Number(unread.totalUnread) || 0);
        setConversationsWithUnread(Number(unread.conversationsWithUnread) || 0);
      } else {
        const total = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        setUnreadTotal(total);
        setConversationsWithUnread(convs.filter((c) => (c.unreadCount || 0) > 0).length);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setAvailable(false);
        setItems([]);
        setUnreadTotal(0);
        setConversationsWithUnread(0);
        return;
      }
      // garde l’état précédent
    } finally {
      setLoading(false);
    }
  }, [allowed, isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated || !allowed || !available) return;

    let socket: ReturnType<typeof getSocket> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 450);
    };

    const onMessageCreated = (msgRaw: unknown) => {
      const msg = normalizeWhatsappMessage(msgRaw);
      if (!msg?.id || !msg.conversationId) return;
      if (msg.direction !== "inbound") {
        scheduleRefresh();
        return;
      }
      if (seenMessageIdsRef.current.has(msg.id)) return;
      seenMessageIdsRef.current.add(msg.id);
      if (seenMessageIdsRef.current.size > 200) {
        const keep = [...seenMessageIdsRef.current].slice(-100);
        seenMessageIdsRef.current = new Set(keep);
      }

      const conv = convByIdRef.current.get(msg.conversationId);
      const title = conv?.contactName?.trim() || conv?.phoneNumber || "WhatsApp";
      const item: WhatsappNotifItem = {
        id: `msg:${msg.id}`,
        conversationId: msg.conversationId,
        title,
        body: previewBody(msg),
        createdAt: msg.createdAt || new Date().toISOString(),
      };

      setItems((prev) => {
        const withoutSameConv = prev.filter((n) => n.conversationId !== item.conversationId);
        return [item, ...withoutSameConv].slice(0, MAX_ITEMS);
      });

      const viewingThis = activeConversationIdRef.current === msg.conversationId;
      if (!viewingThis) {
        setUnreadTotal((n) => n + 1);
        setConversationsWithUnread((n) => {
          const already = convByIdRef.current.get(msg.conversationId)?.unreadCount;
          return already && already > 0 ? n : n + 1;
        });
        if (soundEnabled) playNotifySound();
      }

      scheduleRefresh();
    };

    const onConversationUpdated = (raw: unknown) => {
      const conv = normalizeWhatsappConversation(raw);
      if (!conv?.id) return;
      convByIdRef.current.set(conv.id, conv);
      if ((conv.unreadCount || 0) === 0) {
        setItems((prev) => prev.filter((n) => n.conversationId !== conv.id));
      }
      scheduleRefresh();
    };

    try {
      socket = getSocket();
      socket.on("message:created", onMessageCreated);
      socket.on("conversation:updated", onConversationUpdated);
      return () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        socket?.off("message:created", onMessageCreated);
        socket?.off("conversation:updated", onConversationUpdated);
      };
    } catch {
      return undefined;
    }
  }, [allowed, available, isAuthenticated, refresh, soundEnabled]);

  const dismissItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<WhatsappNotificationsContextValue>(
    () => ({
      items,
      unreadTotal,
      conversationsWithUnread,
      loading,
      available: available && allowed,
      soundEnabled,
      setSoundEnabled,
      setActiveConversationId,
      refresh,
      dismissItem,
      clearItems,
    }),
    [
      items,
      unreadTotal,
      conversationsWithUnread,
      loading,
      available,
      allowed,
      soundEnabled,
      setSoundEnabled,
      setActiveConversationId,
      refresh,
      dismissItem,
      clearItems,
    ],
  );

  return (
    <WhatsappNotificationsContext.Provider value={value}>
      {children}
    </WhatsappNotificationsContext.Provider>
  );
}

export function useWhatsappNotifications() {
  const ctx = useContext(WhatsappNotificationsContext);
  if (!ctx) {
    throw new Error("useWhatsappNotifications must be used within WhatsappNotificationsProvider");
  }
  return ctx;
}
