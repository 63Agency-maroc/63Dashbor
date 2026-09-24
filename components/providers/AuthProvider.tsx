"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { loginRequest, meRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  clearSession,
  displayName,
  getStoredUser,
  getToken,
  saveSession,
  updateStoredUser,
  type AuthUser,
} from "@/lib/auth/storage";
import { disconnectSocket } from "@/lib/realtime/socket";

type AuthContextValue = {
  user: AuthUser | null;
  permissions: string[] | Record<string, unknown> | null;
  route: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  logout: () => void;
  /** Re-fetch GET /auth/me et met à jour le context + storage */
  refreshUser: () => Promise<AuthUser | null>;
  /** Applique un user déjà reçu (ex. réponse PATCH) dans le context + storage */
  applyUser: (user: AuthUser) => void;
  displayName: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[] | Record<string, unknown> | null>(null);
  const [route, setRoute] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = getToken();
      if (!token) {
        if (!cancelled) {
          setHasToken(false);
          setUser(null);
          setPermissions(null);
          setRoute(null);
          setIsLoading(false);
        }
        return;
      }

      setHasToken(true);
      const cached = getStoredUser();
      if (cached && !cancelled) setUser(cached);

      try {
        const me = await meRequest();
        if (cancelled) return;
        setUser(me.user);
        setPermissions(me.permissions ?? null);
        setRoute(me.route ?? null);
        saveSession({
          accessToken: token,
          user: me.user,
          permissions: me.permissions,
          route: me.route,
        });
      } catch {
        if (cancelled) return;
        disconnectSocket();
        clearSession();
        setHasToken(false);
        setUser(null);
        setPermissions(null);
        setRoute(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, redirectTo?: string) => {
      const res = await loginRequest(email.trim(), password);
      if (!res?.accessToken) {
        throw new ApiError("Réponse login invalide (accessToken manquant).", 500, res);
      }
      saveSession({
        accessToken: res.accessToken,
        user: res.user ?? {},
        permissions: res.permissions,
        route: res.route,
      });
      setHasToken(true);
      setUser(res.user ?? {});
      setPermissions(res.permissions ?? null);
      setRoute(res.route ?? null);

      const target =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : res.route && typeof res.route === "string" && res.route.startsWith("/")
            ? res.route
            : "/";
      router.replace(target);
    },
    [router],
  );

  const logout = useCallback(() => {
    disconnectSocket();
    clearSession();
    setHasToken(false);
    setUser(null);
    setPermissions(null);
    setRoute(null);
    router.replace("/login");
  }, [router]);

  const applyUser = useCallback((next: AuthUser) => {
    setUser(next);
    updateStoredUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) return null;
    const me = await meRequest();
    setUser(me.user);
    setPermissions(me.permissions ?? null);
    setRoute(me.route ?? null);
    saveSession({
      accessToken: token,
      user: me.user,
      permissions: me.permissions,
      route: me.route,
    });
    return me.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      route,
      isLoading,
      isAuthenticated: hasToken && !!user,
      login,
      logout,
      refreshUser,
      applyUser,
      displayName: displayName(user),
    }),
    [user, permissions, route, isLoading, hasToken, login, logout, refreshUser, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
