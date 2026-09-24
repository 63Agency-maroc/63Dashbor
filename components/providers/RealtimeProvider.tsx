"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  connectSocket,
  disconnectSocket,
  getSocketStatus,
  subscribeSocketStatus,
  type SocketStatus,
} from "@/lib/realtime/socket";

type RealtimeContextValue = {
  status: SocketStatus;
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Ouvre la connexion socket.io une fois pour le dashboard (leads, WhatsApp, notifs…).
 * Connecte seulement si authentifié ; déconnecte au logout.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [status, setStatus] = useState<SocketStatus>(getSocketStatus);

  useEffect(() => subscribeSocketStatus(setStatus), []);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, isLoading]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      connected: status === "connected",
    }),
    [status],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
