/** Champs du PDF marque 63 Agency (POST /proposals/pdf et /leads/:id/proposal/pdf). */

export type ProposalPdfLanguage = "fr" | "en";

export type BrandedProposalPdfDto = {
  client: string;
  date: string;
  offerName: string;
  price: string;
  currency: string;
  period: string;
  adBudget: string;
  language: ProposalPdfLanguage;
};

export const BRANDED_PROPOSAL_DEFAULTS_BY_LANG = {
  fr: {
    offerName: "Partenariat de 3 mois",
    price: "13 500,00",
    currency: "DHS",
    period: "PAR TRIMESTRE",
    adBudget:
      "Les dépenses publicitaires restent à la charge de l’entreprise cliente, avec un budget initial minimum de 3 000 DHS/mois.",
  },
  en: {
    offerName: "3-Month Partnership",
    price: "13 500,00",
    currency: "DHS",
    period: "PER QUARTER",
    adBudget:
      "Advertising spend remains the responsibility of the client company, with a minimum starting budget of 3,000 DHS/month.",
  },
} as const;

/** @deprecated use BRANDED_PROPOSAL_DEFAULTS_BY_LANG.fr */
export const BRANDED_PROPOSAL_DEFAULTS = BRANDED_PROPOSAL_DEFAULTS_BY_LANG.fr;

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

const MONTHS_EN = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

export function normalizeProposalLanguage(value?: string | null): ProposalPdfLanguage {
  const v = (value ?? "").trim().toLowerCase();
  return v === "en" || v === "english" || v === "anglais" ? "en" : "fr";
}

export function defaultProposalMonth(now = new Date(), language: ProposalPdfLanguage = "fr") {
  const months = language === "en" ? MONTHS_EN : MONTHS_FR;
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

/** YYYY-MM-DD → "NOV 2026" ; sinon mois courant. */
export function proposalMonthFromYmd(ymd?: string | null, language: ProposalPdfLanguage = "fr") {
  const months = language === "en" ? MONTHS_EN : MONTHS_FR;
  const m = (ymd ?? "").trim().match(/^(\d{4})-(\d{2})/);
  if (!m) return defaultProposalMonth(new Date(), language);
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return defaultProposalMonth(new Date(), language);
  return `${months[monthIdx]} ${m[1]}`;
}

/** "JUL 2026" / "FÉV 2026" → YYYY-MM-01 ; sinon aujourd’hui. */
export function ymdFromProposalMonth(label?: string | null) {
  const raw = (label ?? "").trim();
  const m = raw.match(/^([A-Za-zÀ-ÿ]{3,4})\s+(\d{4})$/u);
  if (!m) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const token = m[1]
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
  const normalizedMonths = MONTHS_FR.map((x) =>
    x.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase(),
  );
  let monthIdx = normalizedMonths.indexOf(token);
  if (monthIdx < 0) {
    const aliases: Record<string, number> = {
      JAN: 0,
      FEV: 1,
      FEB: 1,
      MAR: 2,
      AVR: 3,
      APR: 3,
      MAI: 4,
      MAY: 4,
      JUN: 5,
      JUL: 6,
      AOU: 7,
      AUG: 7,
      SEP: 8,
      OCT: 9,
      NOV: 10,
      DEC: 11,
    };
    monthIdx = aliases[token] ?? -1;
  }
  if (monthIdx < 0) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  return `${m[2]}-${String(monthIdx + 1).padStart(2, "0")}-01`;
}

export function brandedProposalFilename(client: string) {
  const cleaned = client.trim().replace(/[^\w.-]+/g, "_") || "Client";
  return `Proposition-${cleaned}.pdf`;
}

export function emptyBrandedProposalForm(
  partial?: Partial<BrandedProposalPdfDto>,
): BrandedProposalPdfDto {
  const language = normalizeProposalLanguage(partial?.language);
  const defaults = BRANDED_PROPOSAL_DEFAULTS_BY_LANG[language];
  return {
    client: (partial?.client ?? "").trim(),
    date: (partial?.date ?? "").trim() || defaultProposalMonth(new Date(), language),
    offerName: (partial?.offerName ?? "").trim() || defaults.offerName,
    price: (partial?.price ?? "").trim() || defaults.price,
    currency: (partial?.currency ?? "").trim() || defaults.currency,
    period: (partial?.period ?? "").trim() || defaults.period,
    adBudget: (partial?.adBudget ?? "").trim() || defaults.adBudget,
    language,
  };
}

/** Switch language and refresh defaulted text fields when they still match the previous defaults. */
export function withProposalLanguage(
  form: BrandedProposalPdfDto,
  language: ProposalPdfLanguage,
): BrandedProposalPdfDto {
  if (form.language === language) return form;
  const prev = BRANDED_PROPOSAL_DEFAULTS_BY_LANG[form.language];
  const next = BRANDED_PROPOSAL_DEFAULTS_BY_LANG[language];
  return {
    ...form,
    language,
    offerName: form.offerName.trim() === prev.offerName ? next.offerName : form.offerName,
    period: form.period.trim() === prev.period ? next.period : form.period,
    adBudget: form.adBudget.trim() === prev.adBudget ? next.adBudget : form.adBudget,
    date: proposalMonthFromYmd(ymdFromProposalMonth(form.date), language),
  };
}

type TariffLine = {
  service?: string | null;
  detail?: string | null;
  prixOffert?: string | null;
  prixInitial?: string | null;
};

type PropositionLike = {
  titreProposition?: string | null;
  preparePour?: string | null;
  nomEtablissement?: string | null;
  clientNom?: string | null;
  dateEmission?: string | null;
  tarifs?: { lignes?: TariffLine[] | null; noteMetaAds?: string | null } | null;
  contact?: { tagline?: string | null } | null;
};

/** Prefill depuis une proposition CRM (liste ou détail). */
export function brandedInitialFromProposition(
  source: PropositionLike,
): Partial<BrandedProposalPdfDto> {
  const language = normalizeProposalLanguage(source.contact?.tagline);
  const client =
    (source.preparePour ?? "").trim() ||
    (source.nomEtablissement ?? "").trim() ||
    (source.clientNom ?? "").trim();

  const line = source.tarifs?.lignes?.[0];
  const price =
    (line?.prixOffert ?? "").trim() || (line?.prixInitial ?? "").trim();
  const currency = (line?.service ?? "").trim();
  const period = (line?.detail ?? "").trim();
  const adBudget = (source.tarifs?.noteMetaAds ?? "").trim();
  const offerName = (source.titreProposition ?? "").trim();

  return {
    language,
    ...(client ? { client } : {}),
    date: proposalMonthFromYmd(source.dateEmission, language),
    ...(offerName ? { offerName } : {}),
    ...(price ? { price } : {}),
    ...(currency ? { currency } : {}),
    ...(period ? { period } : {}),
    ...(adBudget ? { adBudget } : {}),
  };
}

/** Formulaire marque 63 → champs CRM (conserve le reste du DTO). */
export function applyBrandedToUpsert<T extends PropositionLike>(
  base: T,
  branded: BrandedProposalPdfDto,
): T {
  const client = branded.client.trim();
  const offerName = branded.offerName.trim();
  const price = branded.price.trim();
  const currency = branded.currency.trim();
  const period = branded.period.trim();
  const adBudget = branded.adBudget.trim();
  const existingLine = base.tarifs?.lignes?.[0];
  const language = normalizeProposalLanguage(branded.language);

  return {
    ...base,
    titreProposition: offerName || (base.titreProposition ?? ""),
    clientNom: client || (base.clientNom ?? ""),
    preparePour: client || (base.preparePour ?? ""),
    nomEtablissement: client || (base.nomEtablissement ?? ""),
    dateEmission: ymdFromProposalMonth(branded.date),
    tarifs: {
      ...(base.tarifs ?? {}),
      lignes: [
        {
          service: currency,
          detail: period,
          prixInitial: existingLine?.prixInitial ?? "",
          prixOffert: price,
        },
      ],
      noteMetaAds: adBudget,
    },
    contact: {
      ...(base.contact ?? {}),
      tagline: language,
    },
  };
}
