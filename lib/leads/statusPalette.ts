/**
 * Palette couleurs badges statut lead (ClickUp / CRM).
 */

export type LeadStatusPalette = {
  label: string;
  /** Classes Bootstrap badge */
  badgeClass: string;
  /** Couleur pastille / fond fort */
  bg: string;
  text: string;
};

const LEAD_STATUS_PALETTE: Record<string, LeadStatusPalette> = {
  new: {
    label: "New",
    badgeClass: "bg-primary-subtle text-primary",
    bg: "#C9A24B",
    text: "#1a1a1a",
  },
  contacted: {
    label: "Contacted",
    badgeClass: "bg-info-subtle text-info",
    bg: "#0dcaf0",
    text: "#053b48",
  },
  qualified: {
    label: "Qualified",
    badgeClass: "bg-success-subtle text-success",
    bg: "#198754",
    text: "#ffffff",
  },
  engaged: {
    label: "Engaged",
    badgeClass: "bg-warning-subtle text-warning",
    bg: "#ffc107",
    text: "#664d03",
  },
  won: {
    label: "Won",
    badgeClass: "bg-success text-white",
    bg: "#157347",
    text: "#ffffff",
  },
  lost: {
    label: "Lost",
    badgeClass: "bg-danger-subtle text-danger",
    bg: "#dc3545",
    text: "#ffffff",
  },
  // Variantes fréquentes ClickUp / FR
  nouveau: {
    label: "Nouveau",
    badgeClass: "bg-primary-subtle text-primary",
    bg: "#C9A24B",
    text: "#1a1a1a",
  },
  contacté: {
    label: "Contacté",
    badgeClass: "bg-info-subtle text-info",
    bg: "#0dcaf0",
    text: "#053b48",
  },
  contacte: {
    label: "Contacté",
    badgeClass: "bg-info-subtle text-info",
    bg: "#0dcaf0",
    text: "#053b48",
  },
  qualifié: {
    label: "Qualifié",
    badgeClass: "bg-success-subtle text-success",
    bg: "#198754",
    text: "#ffffff",
  },
  qualifie: {
    label: "Qualifié",
    badgeClass: "bg-success-subtle text-success",
    bg: "#198754",
    text: "#ffffff",
  },
  gagné: {
    label: "Gagné",
    badgeClass: "bg-success text-white",
    bg: "#157347",
    text: "#ffffff",
  },
  gagne: {
    label: "Gagné",
    badgeClass: "bg-success text-white",
    bg: "#157347",
    text: "#ffffff",
  },
  perdu: {
    label: "Perdu",
    badgeClass: "bg-danger-subtle text-danger",
    bg: "#dc3545",
    text: "#ffffff",
  },
  pending: {
    label: "Pending",
    badgeClass: "bg-secondary-subtle text-secondary",
    bg: "#6c757d",
    text: "#ffffff",
  },
  in_progress: {
    label: "In progress",
    badgeClass: "bg-info-subtle text-info",
    bg: "#3B82F6",
    text: "#ffffff",
  },
  "in progress": {
    label: "In progress",
    badgeClass: "bg-info-subtle text-info",
    bg: "#3B82F6",
    text: "#ffffff",
  },
};

const FALLBACK_COLORS = [
  { bg: "#8B5CF6", text: "#ffffff", badgeClass: "bg-primary-subtle text-primary" },
  { bg: "#EC4899", text: "#ffffff", badgeClass: "bg-danger-subtle text-danger" },
  { bg: "#14B8A6", text: "#ffffff", badgeClass: "bg-success-subtle text-success" },
  { bg: "#F97316", text: "#ffffff", badgeClass: "bg-warning-subtle text-warning" },
  { bg: "#6366F1", text: "#ffffff", badgeClass: "bg-info-subtle text-info" },
];

function hashStatus(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function getLeadStatusPalette(status: string | null | undefined): LeadStatusPalette {
  const raw = (status ?? "").trim();
  if (!raw) {
    return {
      label: "—",
      badgeClass: "bg-secondary-subtle text-secondary",
      bg: "#adb5bd",
      text: "#212529",
    };
  }
  const key = raw.toLowerCase();
  const known = LEAD_STATUS_PALETTE[key];
  if (known) return { ...known, label: raw };
  const fb = FALLBACK_COLORS[hashStatus(key) % FALLBACK_COLORS.length];
  return {
    label: raw,
    badgeClass: fb.badgeClass,
    bg: fb.bg,
    text: fb.text,
  };
}

/** Badge Bootstrap + pastille couleur pour liste leads */
export function leadStatusBadgeClass(status: string | null | undefined): string {
  return getLeadStatusPalette(status).badgeClass;
}
