import type { MeetingStatus } from "@/lib/api/meetings";

/**
 * Palette couleurs FullCalendar / badges par statut meeting.
 *
 * Sémantique + dégradés (pas la même teinte pour tout un groupe) :
 * - Positif (verts)     → confirmed (clair) → bon_qualified → done (foncé)
 * - Attention (oranges) → non_qualified (ambre) → no_answer (orange vif)
 * - Négatif (rouges)    → cancelled (bordeaux) → no_show (rouge vif)
 * - Neutre / pipeline   → scheduled (bleu), reported (gris)
 */
export type StatusPaletteEntry = {
  label: string;
  bg: string;
  border: string;
  text: string;
  badgeClass: string;
  classNames?: string[];
};

export const STATUS_PALETTE: Record<string, StatusPaletteEntry> = {
  scheduled: {
    label: "Scheduled",
    bg: "#1F4E79",
    border: "#1F4E79",
    text: "#ffffff",
    badgeClass: "bg-primary-subtle text-primary",
  },
  /** Vert clair — confirmé, pas encore conclu */
  confirmed: {
    label: "Confirmed",
    bg: "#75b798",
    border: "#75b798",
    text: "#ffffff",
    badgeClass: "bg-success-subtle text-success",
  },
  /** Vert moyen — bon qualifié */
  bon_qualified: {
    label: "Bon qualified",
    bg: "#198754",
    border: "#198754",
    text: "#ffffff",
    badgeClass: "bg-success-subtle text-success",
  },
  /** Vert foncé — terminé / gagné */
  done: {
    label: "Done",
    bg: "#0a3622",
    border: "#0a3622",
    text: "#ffffff",
    badgeClass: "bg-success-subtle text-success",
  },
  /** Ambre — non qualifié */
  non_qualified: {
    label: "Non qualified",
    bg: "#ffc107",
    border: "#ffc107",
    text: "#664d03",
    badgeClass: "bg-warning-subtle text-warning",
  },
  /** Orange vif — sans réponse */
  no_answer: {
    label: "No answer",
    bg: "#fd7e14",
    border: "#fd7e14",
    text: "#ffffff",
    badgeClass: "bg-warning text-dark",
  },
  /** Bordeaux — annulé */
  cancelled: {
    label: "Cancelled",
    bg: "#a71d2a",
    border: "#a71d2a",
    text: "#ffffff",
    badgeClass: "bg-danger-subtle text-danger text-decoration-line-through",
    classNames: ["fc-event-cancelled"],
  },
  /** Rouge vif — no-show */
  no_show: {
    label: "No show",
    bg: "#dc3545",
    border: "#dc3545",
    text: "#ffffff",
    badgeClass: "bg-danger-subtle text-danger",
  },
  reported: {
    label: "Reported",
    bg: "#6c757d",
    border: "#6c757d",
    text: "#ffffff",
    badgeClass: "bg-secondary-subtle text-secondary",
  },
};

export function getStatusPalette(status: MeetingStatus | string | undefined): StatusPaletteEntry {
  const key = (status ?? "scheduled").trim().toLowerCase();
  return (
    STATUS_PALETTE[key] ?? {
      label: status || "Unknown",
      bg: "#6c757d",
      border: "#6c757d",
      text: "#ffffff",
      badgeClass: "bg-secondary-subtle text-secondary",
    }
  );
}
