/**
 * Couleurs stables par closer / membre d’équipe (calendrier).
 *
 * Priorité : index dans la liste équipe (triée) → 1 membre = 1 teinte distincte.
 * Sinon hash sur userId (fallback).
 */

export type AssigneeColor = {
  bg: string;
  border: string;
  text: string;
};

/** Teintes bien séparées (pas de double orange) — lisibles sur le calendrier */
const TEAM_PALETTE: AssigneeColor[] = [
  { bg: "#1F4E79", border: "#183E61", text: "#ffffff" }, // navy (marque)
  { bg: "#0F766E", border: "#0D635C", text: "#ffffff" }, // teal
  { bg: "#2563EB", border: "#1D4ED8", text: "#ffffff" }, // blue
  { bg: "#059669", border: "#047857", text: "#ffffff" }, // green
  { bg: "#0369A1", border: "#025887", text: "#ffffff" }, // sky
  { bg: "#BE123C", border: "#9F1239", text: "#ffffff" }, // rose
  { bg: "#4B5563", border: "#374151", text: "#ffffff" }, // gray
  { bg: "#7C2D12", border: "#5C1F0C", text: "#ffffff" }, // brown
  { bg: "#0E7490", border: "#0C637A", text: "#ffffff" }, // cyan
  { bg: "#15803D", border: "#166534", text: "#ffffff" }, // forest
  { bg: "#1E293B", border: "#0F172A", text: "#ffffff" }, // slate dark
  { bg: "#A16207", border: "#854D0E", text: "#ffffff" }, // mustard (1 seul warm)
];

const UNASSIGNED: AssigneeColor = {
  bg: "#94A3B8",
  border: "#64748B",
  text: "#ffffff",
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function rosterIndex(userId: string, teamIds: string[]): number {
  const sorted = [...new Set(teamIds.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return sorted.indexOf(userId);
}

export function getAssigneeColor(
  userId: string | null | undefined,
  teamIds?: string[] | null,
): AssigneeColor {
  if (!userId) return UNASSIGNED;
  if (teamIds && teamIds.length > 0) {
    const idx = rosterIndex(userId, teamIds);
    if (idx >= 0) return TEAM_PALETTE[idx % TEAM_PALETTE.length];
  }
  return TEAM_PALETTE[hashId(userId) % TEAM_PALETTE.length];
}

export function getMeetingAssigneeColor(
  meeting: {
    assignees?: { id: string }[] | null;
    assignedUserIds?: string[] | null;
  },
  teamIds?: string[] | null,
): AssigneeColor {
  const fromAssignees = meeting.assignees?.[0]?.id;
  const fromIds = meeting.assignedUserIds?.[0];
  return getAssigneeColor(fromAssignees || fromIds || null, teamIds);
}
