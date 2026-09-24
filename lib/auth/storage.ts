/**
 * Stockage session auth (sans React).
 * - localStorage : accessToken + user (source pour le client API)
 * - cookie `nexlink_token` : présence du JWT pour le middleware Next.js
 */

export const TOKEN_KEY = "nexlink_access_token";
export const USER_KEY = "nexlink_auth_user";
export const COOKIE_TOKEN = "nexlink_token";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

export type AuthRole = "admin" | "admin_whatsapp" | "fixed_meeting" | string;

/** Contrat GET /auth/me + PATCH /users/me */
export type AuthUser = {
  id?: string | number;
  email?: string;
  role?: AuthRole;
  prenom?: string;
  nom?: string;
  telephone?: string | null;
  ville?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
  /** Fallbacks legacy */
  name?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  avatar?: string | null;
  photo?: string | null;
  image?: string | null;
  [key: string]: unknown;
};

export type AuthSessionPayload = {
  accessToken: string;
  user: AuthUser;
  route?: string;
  permissions?: string[] | Record<string, unknown>;
};

function canUseDom() {
  return typeof window !== "undefined";
}

export function getToken(): string | null {
  if (!canUseDom()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!canUseDom()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function setAuthCookie(token: string) {
  document.cookie = `${COOKIE_TOKEN}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearAuthCookie() {
  document.cookie = `${COOKIE_TOKEN}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function saveSession(payload: AuthSessionPayload) {
  if (!canUseDom()) return;
  localStorage.setItem(TOKEN_KEY, payload.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user ?? {}));
  setAuthCookie(payload.accessToken);
}

/** Met à jour uniquement le user en session (après PATCH profil / avatar). */
export function updateStoredUser(user: AuthUser) {
  if (!canUseDom()) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user ?? {}));
}

export function clearSession() {
  if (!canUseDom()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearAuthCookie();
}

export function displayName(user: AuthUser | null | undefined): string {
  if (!user) return "User";
  const fromPrenomNom = [user.prenom, user.nom].filter(Boolean).join(" ").trim();
  return (
    fromPrenomNom ||
    user.fullName ||
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "User"
  );
}

export function avatarUrl(user: AuthUser | null | undefined): string {
  const src = user?.avatarUrl || user?.avatar || user?.photo || user?.image;
  if (typeof src === "string" && src.length > 0) return src;
  return "/assets/images/avatar/avatar1.webp";
}

export function roleLabel(role: string | undefined | null): string {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "Administrateur";
  if (r === "admin_whatsapp") return "Admin WhatsApp";
  if (r === "fixed_meeting") return "Réunions fixes";
  return role || "Utilisateur";
}

export function userInitials(user: AuthUser | null | undefined): string {
  const a = (user?.prenom || user?.firstName || "").trim();
  const b = (user?.nom || user?.lastName || "").trim();
  if (a || b) return `${a.charAt(0)}${b.charAt(0)}`.toUpperCase() || "?";
  const email = user?.email || "";
  return email.charAt(0).toUpperCase() || "?";
}
