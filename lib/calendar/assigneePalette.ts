/**
 * Couleurs stables par closer / membre d’équipe (calendrier).
 * Même userId → toujours la même couleur.
 *
 * Palette pro alignée marque 63 (ink / teal / slate) :
 * tons distincts, saturés modérés, texte blanc pour la lisibilité.
 */

export type AssigneeColor = {
  bg: string;
  border: string;
  text: string;
};

const TEAM_PALETTE: AssigneeColor[] = [
  { bg: "#1F4E79", border: "#183E61", text: "#ffffff" }, // ink blue (marque)
  { bg: "#2563EB", border: "#1D4ED8", text: "#ffffff" }, // royal blue
  { bg: "#0E7490", border: "#0C637A", text: "#ffffff" }, // cyan steel
  { bg: "#0F766E", border: "#0D635C", text: "#ffffff" }, // teal
  { bg: "#047857", border: "#036347", text: "#ffffff" }, // emerald
  { bg: "#0369A1", border: "#025887", text: "#ffffff" }, // sky
  { bg: "#B45309", border: "#92400A", text: "#ffffff" }, // amber warm
  { bg: "#C2410C", border: "#9A3412", text: "#ffffff" }, // burnt orange
  { bg: "#BE123C", border: "#9F1239", text: "#ffffff" }, // rose
  { bg: "#334155", border: "#1E293B", text: "#ffffff" }, // slate
  { bg: "#4B5563", border: "#374151", text: "#ffffff" }, // cool gray
  { bg: "#3F6212", border: "#365314", text: "#ffffff" }, // olive
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
