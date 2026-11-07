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

export type ProposalOfferId = "1m" | "3m" | "6m" | "1y";

export const PROPOSAL_OFFER_OPTIONS: {
  id: ProposalOfferId;
  fr: string;
  en: string;
}[] = [
  { id: "1m", fr: "Partenariat 1 mois", en: "1-Month Partnership" },
  { id: "3m", fr: "Partenariat 3 mois", en: "3-Month Partnership" },
  { id: "6m", fr: "Partenariat 6 mois", en: "6-Month Partnership" },
  { id: "1y", fr: "Partenariat 1 ans", en: "1-Year Partnership" },
];

export function proposalOfferLabel(id: ProposalOfferId, language: ProposalPdfLanguage) {
  const opt = PROPOSAL_OFFER_OPTIONS.find((o) => o.id === id);
  return opt ? opt[language] : PROPOSAL_OFFER_OPTIONS[1][language];
}

/** Période auto selon l’offre. */
export const PROPOSAL_PERIOD_BY_OFFER: Record<
  ProposalOfferId,
  { fr: string; en: string }
> = {
  "1m": { fr: "PAR MOIS", en: "PER MONTH" },
  "3m": { fr: "PAR TRIMESTRE", en: "PER QUARTER" },
  "6m": { fr: "PAR SEMESTRE", en: "PER SEMESTER" },
  "1y": { fr: "PAR ANS", en: "PER YEAR" },
};

export function proposalPeriodLabel(id: ProposalOfferId, language: ProposalPdfLanguage) {
  return PROPOSAL_PERIOD_BY_OFFER[id]?.[language] ?? PROPOSAL_PERIOD_BY_OFFER["3m"][language];
}

export function resolveProposalOfferId(
  offerName?: string | null,
): ProposalOfferId {
  const raw = (offerName ?? "").trim().toLowerCase();
  if (!raw) return "3m";
  for (const opt of PROPOSAL_OFFER_OPTIONS) {
    if (raw === opt.fr.toLowerCase() || raw === opt.en.toLowerCase()) return opt.id;
  }
  if (/\b1\s*an|\b1\s*year|\b12\s*mois|\b12\s*month/.test(raw)) return "1y";
  if (/\b6\s*mois|\b6\s*month/.test(raw)) return "6m";
  if (/\b1\s*mois|\b1\s*month/.test(raw)) return "1m";
  if (/\b3\s*mois|\b3\s*month/.test(raw)) return "3m";
  return "3m";
}

export const BRANDED_PROPOSAL_DEFAULTS_BY_LANG = {
  fr: {
    offerName: proposalOfferLabel("3m", "fr"),
    price: "13 500,00",
    currency: "DHS",
    period: proposalPeriodLabel("3m", "fr"),
    adBudget:
      "Les dépenses publicitaires restent à la charge de l’entreprise cliente, avec un budget initial minimum de 3 000 DHS/mois.",
  },
  en: {
    offerName: proposalOfferLabel("3m", "en"),
    price: "13 500,00",
    currency: "DHS",
    period: proposalPeriodLabel("3m", "en"),
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
  // Mois / année de création (fuseau Casablanca)
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Casablanca",
      month: "numeric",
      year: "numeric",
    }).formatToParts(now);
    const monthNum = Number(parts.find((p) => p.type === "month")?.value ?? NaN);
    const yearNum = Number(parts.find((p) => p.type === "year")?.value ?? NaN);
    if (monthNum >= 1 && monthNum <= 12 && yearNum > 2000) {
      return `${months[monthNum - 1]} ${yearNum}`;
    }
  } catch {
    /* fallback local */
  }
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
  const offerId = resolveProposalOfferId(partial?.offerName);
  return {
    client: (partial?.client ?? "").trim(),
    date: (partial?.date ?? "").trim() || defaultProposalMonth(new Date(), language),
    offerName: proposalOfferLabel(offerId, language),
    price: (partial?.price ?? "").trim() || defaults.price,
    currency: (partial?.currency ?? "").trim() || defaults.currency,
    // Période toujours alignée sur l’offre
    period: proposalPeriodLabel(offerId, language),
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
  const offerId = resolveProposalOfferId(form.offerName);
  return {
    ...form,
    language,
    offerName: proposalOfferLabel(offerId, language),
    period: proposalPeriodLabel(offerId, language),
    adBudget: form.adBudget.trim() === prev.adBudget ? next.adBudget : form.adBudget,
    date: proposalMonthFromYmd(ymdFromProposalMonth(form.date), language),
  };
}

/** Change d’offre → met à jour le libellé + la période associée. */
export function withProposalOffer(
  form: BrandedProposalPdfDto,
  offerId: ProposalOfferId,
): BrandedProposalPdfDto {
  const language = normalizeProposalLanguage(form.language);
  return {
    ...form,
    offerName: proposalOfferLabel(offerId, language),
    period: proposalPeriodLabel(offerId, language),
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
