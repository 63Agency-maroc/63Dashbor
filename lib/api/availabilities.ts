import { api } from "@/lib/api/client";

export type AvailabilitySlot = {
  start: string; // HH:mm
  end: string; // HH:mm
};

export type AvailabilityDay = {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  timezone: string; // IANA
  slots: AvailabilitySlot[];
  createdAt: string;
  updatedAt: string;
};

export type AvailabilitiesListResponse = {
  items: AvailabilityDay[];
};

export type UpsertAvailabilityDto = {
  date: string;
  timezone: string;
  slots: AvailabilitySlot[];
};

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/** Mes disponibilités (admin courant) */
export function getMyAvailabilities(params: { from?: string; to?: string } = {}) {
  return api.get<AvailabilitiesListResponse>(
    `/meetings/availabilities${buildQuery({ from: params.from, to: params.to })}`,
  );
}

/** Disponibilités d’un user : GET /meetings/availabilities/:userId?from=&to= */
export function getUserAvailabilities(
  userId: string,
  params: { from?: string; to?: string } = {},
) {
  return api.get<AvailabilitiesListResponse>(
    `/meetings/availabilities/${encodeURIComponent(userId)}${buildQuery({
      from: params.from,
      to: params.to,
    })}`,
  );
}

/** Upsert d’un jour */
export function upsertAvailability(dto: UpsertAvailabilityDto) {
  return api.put<AvailabilityDay>("/meetings/availabilities", dto);
}

/** Supprime les dispos d’un jour civil YYYY-MM-DD */
export function deleteAvailability(date: string) {
  return api.delete<void>(`/meetings/availabilities/${encodeURIComponent(date)}`);
}
