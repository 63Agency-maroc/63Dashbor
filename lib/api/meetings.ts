import { api, ApiError } from "@/lib/api/client";

/** Titres whitelist (exacts) */
export const MEETING_TITLES = [
  "Audit Performance Marketing",
  "Audit Performance Marketing présentiel",
  "Audit Performance Marketing online",
  "Appel téléphonique",
] as const;

export type MeetingTitle = (typeof MEETING_TITLES)[number];

/** Statuts (9) */
export const MEETING_STATUSES = [
  "scheduled",
  "confirmed",
  "bon_qualified",
  "non_qualified",
  "done",
  "no_answer",
  "cancelled",
  "reported",
  "no_show",
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export type ReminderFlags = {
  "2d"?: boolean;
  "24h"?: boolean;
  "2h"?: boolean;
};

export type MeetingReminders = {
  whatsapp?: ReminderFlags;
  email?: ReminderFlags;
};

export type MeetingMember = {
  leadId?: string;
  name: string;
  phone?: string;
  email?: string;
};

export type MeetingAssignee = {
  id: string;
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string;
  ville?: string;
  role?: string;
  [key: string]: unknown;
};

export type Meeting = {
  id: string;
  leadId: string | null;
  title: string;
  meetingDate: string;
  /** Durée en minutes (15|30|45|60|90|120), défaut API 30 */
  durationMinutes?: number | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  members: MeetingMember[];
  assignedUserIds: string[];
  assignees: MeetingAssignee[];
  createdBy: string | null;
  status: MeetingStatus | string;
  reminders: MeetingReminders | null;
  remindersStatus: unknown;
  meetLink: string | null;
  meetSpace: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssignableUser = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  ville?: string;
  role?: string;
};

export type BlockedDay = {
  id: string;
  date: string;
  reason: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type MeetingsStats = {
  today: number;
  thisWeek: number;
  pending: number;
  noShow: number;
};

export type CreateMeetingDto = {
  title: MeetingTitle | string;
  meetingDate: string;
  durationMinutes?: number;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  leadId?: string;
  status?: MeetingStatus | string;
  notes?: string;
  members?: MeetingMember[];
  assignedUserIds?: string[];
  reminders?: MeetingReminders;
  notifyOnCreate?: boolean;
};

export type UpdateMeetingDto = CreateMeetingDto;

export type SendReminderDto = {
  channel?: "whatsapp" | "email" | "both";
  offset?: "2d" | "24h" | "2h";
  force?: boolean;
};

export type MeetingsQuery = {
  from?: string;
  to?: string;
  status?: string;
  assignedUserId?: string;
};

export type MeetingsListResponse = {
  items: Meeting[];
};

export type BlockedDaysResponse = {
  items: BlockedDay[];
};

export type DeleteMeetingResponse = {
  ok: boolean;
  id: string;
};

export type SendReminderResponse = {
  ok: boolean;
  whatsappSent?: boolean;
  emailSent?: boolean;
  [key: string]: unknown;
};

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function getMeetings(params: MeetingsQuery) {
  return api.get<MeetingsListResponse>(
    `/meetings${buildQuery({
      from: params.from,
      to: params.to,
      status: params.status,
      assignedUserId: params.assignedUserId,
    })}`,
  );
}

export function getMeetingsToday() {
  return api.get<MeetingsListResponse>("/meetings/today");
}

export function getMeetingsUpcoming() {
  return api.get<MeetingsListResponse>("/meetings/upcoming");
}

export function getMeetingsStats() {
  return api.get<MeetingsStats>("/meetings/stats");
}

export function getAssignableUsers() {
  return api.get<AssignableUser[]>("/meetings/assignable-users");
}

export function getBlockedDays(params: { from: string; to: string }) {
  return api.get<BlockedDaysResponse>(
    `/meetings/blocked-days${buildQuery({ from: params.from, to: params.to })}`,
  );
}

export function createBlockedDay(dto: { date: string; reason?: string }) {
  return api.post<BlockedDay>("/meetings/blocked-days", dto);
}

export function deleteBlockedDay(id: string) {
  return api.delete<void>(`/meetings/blocked-days/${id}`);
}

export function createMeeting(dto: CreateMeetingDto) {
  return api.post<Meeting>("/meetings", dto);
}

export function updateMeeting(id: string, dto: UpdateMeetingDto) {
  return api.patch<Meeting>(`/meetings/${id}`, dto);
}

export function deleteMeeting(id: string) {
  return api.delete<DeleteMeetingResponse>(`/meetings/${id}`);
}

export function sendReminder(id: string, dto: SendReminderDto = {}) {
  return api.post<SendReminderResponse>(`/meetings/${id}/send-reminder`, dto);
}

export function regenerateMeet(id: string) {
  return api.post<Meeting>(`/meetings/${id}/regenerate-meet`);
}

export const DEFAULT_REMINDERS: MeetingReminders = {
  whatsapp: { "2d": true, "24h": true, "2h": true },
  email: { "2d": true, "24h": true, "2h": true },
};

/**
 * Message utilisateur pour create/update meeting.
 * 409 (indispo / jour bloqué) → message API tel quel.
 * Autres → message API ou fallback clair.
 */
export function formatMeetingSaveError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Échec de l’enregistrement. Réessayez.";
  }

  const apiMsg = (err.message || "").trim();
  const blob = `${apiMsg} ${typeof err.body === "string" ? err.body : JSON.stringify(err.body ?? "")}`;

  if (err.status === 409) {
    if (apiMsg) return apiMsg;
    if (/indisponible/i.test(blob)) {
      return "Un administrateur assigné est indisponible à cet horaire.";
    }
    if (/bloqu/i.test(blob)) {
      return "Ce jour est bloqué.";
    }
    return "Conflit : vérifiez la date, l’horaire ou les assignés.";
  }

  if (err.status === 400) {
    return apiMsg || "Données invalides. Vérifiez le formulaire.";
  }

  if (err.status === 403) {
    return apiMsg || "Vous n’avez pas le droit d’effectuer cette action.";
  }

  if (err.status === 0) {
    return apiMsg || "Impossible de joindre le serveur. Vérifiez votre connexion.";
  }

  return apiMsg || `Erreur ${err.status}. Réessayez.`;
}
