import { api } from "@/lib/api/client";
import type { AuthUser } from "@/lib/auth/storage";

/** Body PATCH /users/me — champs profil éditables uniquement */
export type UpdateMyProfileDto = {
  prenom?: string;
  nom?: string;
  telephone?: string;
  ville?: string;
  bio?: string;
  avatarUrl?: string;
  timezone?: string;
};

export function updateMyProfile(dto: UpdateMyProfileDto) {
  return api.patch<AuthUser>("/users/me", dto);
}

/** PATCH /users/me/timezone — fuseau IANA du viewer */
export function updateMyTimezone(timezone: string) {
  return api.patch<AuthUser>("/users/me/timezone", { timezone });
}

/** Rôles gérés côté admin (CRUD employés) */
export type UserRole = "admin" | "admin_whatsapp" | "fixed_meeting";

export const USER_ROLES: UserRole[] = ["admin", "admin_whatsapp", "fixed_meeting"];

export type Employee = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  ville: string | null;
  role: UserRole | string;
  avatarUrl: string | null;
  createdAt: string;
  lastSeen: string | null;
  online: boolean;
};

export type CreateUserDto = {
  prenom: string;
  nom: string;
  email: string;
  password: string;
  role: UserRole | string;
  telephone?: string;
  ville?: string;
};

export type UpdateUserDto = {
  prenom?: string;
  nom?: string;
  email?: string;
  password?: string;
  role?: UserRole | string;
  telephone?: string;
  ville?: string;
  avatarUrl?: string;
};

function asTrimmed(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Normalise un user API (camelCase / snake_case) */
export function normalizeEmployee(raw: unknown): Employee {
  const u = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const onlineRaw = u.online ?? u.isOnline ?? u.is_online;
  return {
    id: String(u.id ?? ""),
    prenom: asTrimmed(u.prenom) ?? "",
    nom: asTrimmed(u.nom) ?? "",
    email: asTrimmed(u.email) ?? "",
    telephone: asTrimmed(u.telephone ?? u.phone),
    ville: asTrimmed(u.ville ?? u.city),
    role: asTrimmed(u.role) ?? "fixed_meeting",
    avatarUrl: asTrimmed(u.avatarUrl ?? u.avatar_url ?? u.avatar),
    createdAt: String(u.createdAt ?? u.created_at ?? ""),
    lastSeen: asTrimmed(u.lastSeen ?? u.last_seen),
    online: onlineRaw === true || onlineRaw === 1 || onlineRaw === "true",
  };
}

export function employeeFullName(e: Pick<Employee, "prenom" | "nom" | "email">): string {
  const n = [e.prenom, e.nom].filter(Boolean).join(" ").trim();
  return n || e.email || "Employé";
}

export function employeeInitials(e: Pick<Employee, "prenom" | "nom" | "email">): string {
  const a = (e.prenom || "").trim();
  const b = (e.nom || "").trim();
  if (a || b) return `${a.charAt(0)}${b.charAt(0)}`.toUpperCase() || "?";
  return (e.email || "?").charAt(0).toUpperCase();
}

/** GET /users — admin (+ admin_whatsapp côté API) */
export async function getUsers(): Promise<Employee[]> {
  const list = await api.get<unknown>("/users");
  const arr = Array.isArray(list) ? list : [];
  return arr.map(normalizeEmployee);
}

/** POST /users — admin */
export async function createUser(dto: CreateUserDto): Promise<Employee> {
  const created = await api.post<unknown>("/users", dto);
  return normalizeEmployee(created);
}

/** PATCH /users/:id — admin */
export async function updateUser(id: string, dto: UpdateUserDto): Promise<Employee> {
  const updated = await api.patch<unknown>(`/users/${id}`, dto);
  return normalizeEmployee(updated);
}

/** DELETE /users/:id — admin (204) */
export function deleteUser(id: string): Promise<void> {
  return api.delete<void>(`/users/${id}`);
}

export type PresenceUpdateEvent = {
  userId: string;
  online: boolean;
  lastSeen: string | null;
};

export function normalizePresenceUpdate(raw: unknown): PresenceUpdateEvent | null {
  const e = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const userId = asTrimmed(e.userId ?? e.user_id ?? e.id);
  if (!userId) return null;
  const onlineRaw = e.online ?? e.isOnline ?? e.is_online;
  return {
    userId,
    online: onlineRaw === true || onlineRaw === 1 || onlineRaw === "true",
    lastSeen: asTrimmed(e.lastSeen ?? e.last_seen),
  };
}
