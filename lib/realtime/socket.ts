/**
 * Client socket.io singleton — même origine que l'API (NEXT_PUBLIC_API_URL).
 * Auth JWT via handshake auth.token (même source que lib/api).
 */

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api/config";
import { getToken } from "@/lib/auth/storage";

let socket: Socket | null = null;

export type SocketStatus = "disconnected" | "connecting" | "connected";

type StatusListener = (status: SocketStatus) => void;
const statusListeners = new Set<StatusListener>();
let currentStatus: SocketStatus = "disconnected";

function setStatus(next: SocketStatus) {
  if (currentStatus === next) return;
  currentStatus = next;
  statusListeners.forEach((fn) => fn(next));
}

export function getSocketStatus(): SocketStatus {
  return currentStatus;
}

export function subscribeSocketStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

/** Singleton socket.io — crée la connexion si absente. */
export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket() is client-only");
  }

  if (socket) return socket;

  const token = getToken();
  setStatus("connecting");

  socket = io(API_BASE_URL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: { token: token ?? "" },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => setStatus("connected"));
  socket.on("disconnect", () => setStatus("disconnected"));
  socket.on("connect_error", () => {
    if (!socket?.connected) setStatus("disconnected");
  });

  // À chaque tentative de reconnexion, rafraîchir le JWT
  socket.io.on("reconnect_attempt", () => {
    if (!socket) return;
    const t = getToken();
    socket.auth = { token: t ?? "" };
  });

  return socket;
}

/** Connecte uniquement si un token est présent. */
export function connectSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = getToken();
  if (!token) {
    disconnectSocket();
    return null;
  }

  const s = getSocket();
  s.auth = { token };
  if (!s.connected) {
    setStatus("connecting");
    s.connect();
  }
  return s;
}

/** Met à jour le token (ex. après login) et reconnecte si besoin. */
export function updateSocketAuth(token: string | null) {
  if (!token) {
    disconnectSocket();
    return;
  }
  if (!socket) {
    connectSocket();
    return;
  }
  socket.auth = { token };
  if (socket.connected) {
    // Reconnect pour renvoyer le handshake avec le nouveau token
    socket.disconnect().connect();
  } else {
    setStatus("connecting");
    socket.connect();
  }
}

/** Déconnecte et détruit le singleton (logout / token expiré). */
export function disconnectSocket() {
  if (!socket) {
    setStatus("disconnected");
    return;
  }
  try {
    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.disconnect();
  } catch {
    /* ignore */
  }
  socket = null;
  setStatus("disconnected");
}
