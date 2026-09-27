/**
 * Palette couleurs statuts documents (devis / factures / propositions).
 */

export type DocStatusPalette = {
  label: string;
  bg: string;
  text: string;
  badgeClass: string;
};

const DOC_STATUS_PALETTE: Record<string, DocStatusPalette> = {
  draft: {
    label: "Brouillon",
    bg: "#6c757d",
    text: "#ffffff",
    badgeClass: "bg-secondary-subtle text-secondary",
  },
  brouillon: {
    label: "Brouillon",
    bg: "#6c757d",
    text: "#ffffff",
    badgeClass: "bg-secondary-subtle text-secondary",
  },
  sent: {
    label: "Envoyé",
    bg: "#0dcaf0",
    text: "#053b48",
    badgeClass: "bg-info-subtle text-info",
  },
  envoyé: {
    label: "Envoyé",
    bg: "#0dcaf0",
    text: "#053b48",
    badgeClass: "bg-info-subtle text-info",
  },
  envoye: {
    label: "Envoyé",
    bg: "#0dcaf0",
    text: "#053b48",
    badgeClass: "bg-info-subtle text-info",
  },
  accepted: {
    label: "Accepté",
    bg: "#198754",
    text: "#ffffff",
    badgeClass: "bg-success-subtle text-success",
  },
  accepté: {
    label: "Accepté",
    bg: "#198754",
    text: "#ffffff",
    badgeClass: "bg-success-subtle text-success",
  },
  accepte: {
    label: "Accepté",
    bg: "#198754",
    text: "#ffffff",
    badgeClass: "bg-success-subtle text-success",
  },
  rejected: {
    label: "Refusé",
    bg: "#dc3545",
    text: "#ffffff",
    badgeClass: "bg-danger-subtle text-danger",
  },
  refusé: {
    label: "Refusé",
    bg: "#dc3545",
    text: "#ffffff",
    badgeClass: "bg-danger-subtle text-danger",
  },
  refuse: {
    label: "Refusé",
    bg: "#dc3545",
    text: "#ffffff",
    badgeClass: "bg-danger-subtle text-danger",
  },
  paid: {
    label: "Payé",
    bg: "#C9A24B",
    text: "#1a1a1a",
    badgeClass: "bg-primary-subtle text-primary",
  },
  payé: {
    label: "Payé",
    bg: "#C9A24B",
    text: "#1a1a1a",
    badgeClass: "bg-primary-subtle text-primary",
  },
  paye: {
    label: "Payé",
    bg: "#C9A24B",
    text: "#1a1a1a",
    badgeClass: "bg-primary-subtle text-primary",
  },
  cancelled: {
    label: "Annulé",
    bg: "#adb5bd",
    text: "#212529",
    badgeClass: "bg-secondary-subtle text-secondary",
  },
  annulé: {
    label: "Annulé",
    bg: "#adb5bd",
    text: "#212529",
    badgeClass: "bg-secondary-subtle text-secondary",
  },
  annule: {
    label: "Annulé",
    bg: "#adb5bd",
    text: "#212529",
    badgeClass: "bg-secondary-subtle text-secondary",
  },
  overdue: {
    label: "En retard",
    bg: "#fd7e14",
    text: "#ffffff",
    badgeClass: "bg-warning text-dark",
  },
  "en retard": {
    label: "En retard",
    bg: "#fd7e14",
    text: "#ffffff",
    badgeClass: "bg-warning text-dark",
  },
  pending: {
    label: "En attente",
    bg: "#ffc107",
    text: "#664d03",
    badgeClass: "bg-warning-subtle text-warning",
  },
  "en attente": {
    label: "En attente",
    bg: "#ffc107",
    text: "#664d03",
    badgeClass: "bg-warning-subtle text-warning",
  },
  viewed: {
    label: "Consulté",
    bg: "#3B82F6",
    text: "#ffffff",
    badgeClass: "bg-info-subtle text-info",
  },
  consulté: {
    label: "Consulté",
    bg: "#3B82F6",
    text: "#ffffff",
    badgeClass: "bg-info-subtle text-info",
  },
  consulte: {
    label: "Consulté",
    bg: "#3B82F6",
    text: "#ffffff",
    badgeClass: "bg-info-subtle text-info",
  },
};

const FALLBACK = [
  { bg: "#8B5CF6", text: "#ffffff", badgeClass: "bg-primary-subtle text-primary" },
  { bg: "#EC4899", text: "#ffffff", badgeClass: "bg-danger-subtle text-danger" },
  { bg: "#14B8A6", text: "#ffffff", badgeClass: "bg-success-subtle text-success" },
  { bg: "#6366F1", text: "#ffffff", badgeClass: "bg-info-subtle text-info" },
];

function hashStatus(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Légende courante pour les pages documents */
export const DOC_STATUS_LEGEND_KEYS = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "paid",
  "cancelled",
  "pending",
] as const;

export function getDocumentStatusPalette(status: string | null | undefined): DocStatusPalette {
  const raw = (status ?? "").trim();
  if (!raw) {
    return {
      label: "—",
      bg: "#adb5bd",
      text: "#212529",
      badgeClass: "bg-secondary-subtle text-secondary",
    };
  }
  const key = raw.toLowerCase();
  const known = DOC_STATUS_PALETTE[key];
  if (known) return { ...known, label: known.label !== raw ? known.label : raw };
  const fb = FALLBACK[hashStatus(key) % FALLBACK.length];
  return {
    label: raw,
    bg: fb.bg,
    text: fb.text,
    badgeClass: fb.badgeClass,
  };
}
