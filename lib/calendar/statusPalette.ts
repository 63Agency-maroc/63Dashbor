import type { MeetingStatus } from "@/lib/api/meetings";

/**
 * Palette couleurs FullCalendar / badges par statut meeting.
 *
 * | status         | couleur   | usage                          |
 * |----------------|-----------|--------------------------------|
 * | scheduled      | primary   | gold — planifié                |
 * | confirmed      | success   | vert — confirmé                |
 * | bon_qualified  | info      | cyan — bon qualifié            |
 * | non_qualified  | warning   | orange — non qualifié          |
 * | done           | secondary | gris — terminé                 |
 * | no_answer      | orange    | #fd7e14 — sans réponse         |
 * | cancelled      | muted     | gris barré                     |
 * | reported       | dark      | sombre — reporté               |
 * | no_show        | danger    | rouge — no-show                |
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
    bg: "#C9A24B",
    border: "#C9A24B",
    text: "#1a1a1a",
    badgeClass: "bg-primary-subtle text-primary",
  },
  confirmed: {
    label: "Confirmed",
    bg: "#198754",
    border: "#198754",
    text: "#ffffff",
    badgeClass: "bg-success-subtle text-success",
  },
  bon_qualified: {
    label: "Bon qualified",
    bg: "#0dcaf0",
    border: "#0dcaf0",
    text: "#053b48",
    badgeClass: "bg-info-subtle text-info",
  },
  non_qualified: {
    label: "Non qualified",
    bg: "#ffc107",
    border: "#ffc107",
    text: "#664d03",
    badgeClass: "bg-warning-subtle text-warning",
  },
  done: {
    label: "Done",
    bg: "#6c757d",
    border: "#6c757d",
    text: "#ffffff",
    badgeClass: "bg-secondary-subtle text-secondary",
  },
  no_answer: {
    label: "No answer",
    bg: "#fd7e14",
    border: "#fd7e14",
    text: "#ffffff",
    badgeClass: "bg-warning text-dark",
  },
  cancelled: {
    label: "Cancelled",
    bg: "#adb5bd",
    border: "#adb5bd",
    text: "#212529",
    badgeClass: "bg-secondary-subtle text-secondary text-decoration-line-through",
    classNames: ["fc-event-cancelled"],
  },
  reported: {
    label: "Reported",
    bg: "#343a40",
    border: "#343a40",
    text: "#ffffff",
    badgeClass: "bg-dark-subtle text-dark",
  },
  no_show: {
    label: "No show",
    bg: "#dc3545",
    border: "#dc3545",
    text: "#ffffff",
    badgeClass: "bg-danger-subtle text-danger",
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
