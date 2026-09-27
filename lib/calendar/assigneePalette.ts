/**
 * Couleurs stables par closer / membre d’équipe (calendrier).
 * Même userId → toujours la même couleur.
 */

export type AssigneeColor = {
  bg: string;
  border: string;
  text: string;
};

const TEAM_PALETTE: AssigneeColor[] = [
  { bg: "#C9A24B", border: "#C9A24B", text: "#1a1a1a" }, // gold 63
  { bg: "#3B82F6", border: "#3B82F6", text: "#ffffff" }, // blue
  { bg: "#10B981", border: "#10B981", text: "#ffffff" }, // emerald
  { bg: "#8B5CF6", border: "#8B5CF6", text: "#ffffff" }, // violet
  { bg: "#F59E0B", border: "#F59E0B", text: "#1a1a1a" }, // amber
  { bg: "#EC4899", border: "#EC4899", text: "#ffffff" }, // pink
  { bg: "#06B6D4", border: "#06B6D4", text: "#053b48" }, // cyan
  { bg: "#EF4444", border: "#EF4444", text: "#ffffff" }, // red
  { bg: "#14B8A6", border: "#14B8A6", text: "#ffffff" }, // teal
  { bg: "#6366F1", border: "#6366F1", text: "#ffffff" }, // indigo
  { bg: "#84CC16", border: "#84CC16", text: "#1a1a1a" }, // lime
  { bg: "#F97316", border: "#F97316", text: "#ffffff" }, // orange
];

const UNASSIGNED: AssigneeColor = {
  bg: "#94A3B8",
  border: "#94A3B8",
  text: "#1a1a1a",
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getAssigneeColor(userId: string | null | undefined): AssigneeColor {
  if (!userId) return UNASSIGNED;
  return TEAM_PALETTE[hashId(userId) % TEAM_PALETTE.length];
}

export function getMeetingAssigneeColor(meeting: {
  assignees?: { id: string }[] | null;
  assignedUserIds?: string[] | null;
}): AssigneeColor {
  const fromAssignees = meeting.assignees?.[0]?.id;
  const fromIds = meeting.assignedUserIds?.[0];
  return getAssigneeColor(fromAssignees || fromIds || null);
}
