import { api } from "@/lib/api/client";
import type { AuthSessionPayload, AuthUser } from "@/lib/auth/storage";

export type LoginResponse = AuthSessionPayload & {
  accessToken: string;
  user: AuthUser;
};

export type MeResponse = {
  user: AuthUser;
  route?: string;
  permissions?: string[] | Record<string, unknown>;
};

export function loginRequest(email: string, password: string) {
  return api.post<LoginResponse>(
    "/auth/login",
    { email, password },
    { skipAuth: true, skipAuthRedirect: true },
  );
}

export function meRequest() {
  return api.get<MeResponse>("/auth/me", { skipAuthRedirect: true });
}

export function changePasswordRequest(currentPassword: string, newPassword: string) {
  return api.post<void>("/auth/change-password", { currentPassword, newPassword });
}

/** Alias explicite pour la page profil */
export function changePassword(dto: { currentPassword: string; newPassword: string }) {
  return changePasswordRequest(dto.currentPassword, dto.newPassword);
}
