/** Champs du PDF marque 63 Agency (POST /proposals/pdf et /leads/:id/proposal/pdf). */

export type BrandedProposalPdfDto = {
  client: string;
  date: string;
  offerName: string;
  price: string;
  currency: string;
  period: string;
  adBudget: string;
};

export const BRANDED_PROPOSAL_DEFAULTS = {
  offerName: "Partenariat de 3 mois",
  price: "13 500,00",
  currency: "DHS",
  period: "PAR TRIMESTRE",
  adBudget:
    "Les dépenses publicitaires restent à la charge de l’entreprise cliente, avec un budget initial minimum de 3 000 DHS/mois.",
} as const;

const MONTHS_FR = [
  "JAN",
  "FÉV",
  "MAR",
  "AVR",
  "MAI",
  "JUN",
  "JUL",
  "AOÛ",
  "SEP",
  "OCT",
  "NOV",
  "DÉC",
] as const;

export function defaultProposalMonth(now = new Date()) {
  return `${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`;
}

/** YYYY-MM-DD → "NOV 2026" ; sinon mois courant. */
export function proposalMonthFromYmd(ymd?: string | null) {
  const m = (ymd ?? "").trim().match(/^(\d{4})-(\d{2})/);
  if (!m) return defaultProposalMonth();
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return defaultProposalMonth();
  return `${MONTHS_FR[monthIdx]} ${m[1]}`;
}

export function brandedProposalFilename(client: string) {
  const cleaned = client.trim().replace(/[^\w.-]+/g, "_") || "Client";
  return `Proposition-${cleaned}.pdf`;
}

export function emptyBrandedProposalForm(
  partial?: Partial<BrandedProposalPdfDto>,
): BrandedProposalPdfDto {
  return {
    client: (partial?.client ?? "").trim(),
    date: (partial?.date ?? "").trim() || defaultProposalMonth(),
    offerName: (partial?.offerName ?? "").trim() || BRANDED_PROPOSAL_DEFAULTS.offerName,
    price: (partial?.price ?? "").trim() || BRANDED_PROPOSAL_DEFAULTS.price,
    currency: (partial?.currency ?? "").trim() || BRANDED_PROPOSAL_DEFAULTS.currency,
    period: (partial?.period ?? "").trim() || BRANDED_PROPOSAL_DEFAULTS.period,
    adBudget: (partial?.adBudget ?? "").trim() || BRANDED_PROPOSAL_DEFAULTS.adBudget,
  };
}

type TariffLine = { prixOffert?: string | null; prixInitial?: string | null };

/** Prefill depuis une proposition CRM (liste ou détail). */
export function brandedInitialFromProposition(source: {
  preparePour?: string | null;
  nomEtablissement?: string | null;
  clientNom?: string | null;
  dateEmission?: string | null;
  tarifs?: { lignes?: TariffLine[] | null } | null;
}): Partial<BrandedProposalPdfDto> {
  const client =
    (source.preparePour ?? "").trim() ||
    (source.nomEtablissement ?? "").trim() ||
    (source.clientNom ?? "").trim();

  let price = "";
  for (const line of source.tarifs?.lignes ?? []) {
    const offert = (line.prixOffert ?? "").trim();
    const initial = (line.prixInitial ?? "").trim();
    if (offert) {
      price = offert;
      break;
    }
    if (initial) {
      price = initial;
      break;
    }
  }

  return {
    ...(client ? { client } : {}),
    date: proposalMonthFromYmd(source.dateEmission),
    ...(price ? { price } : {}),
  };
}
