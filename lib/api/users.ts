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
};

export function updateMyProfile(dto: UpdateMyProfileDto) {
  return api.patch<AuthUser>("/users/me", dto);
}
