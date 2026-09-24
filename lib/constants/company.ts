/** Infos société 63 Agency — préremplissage devis / factures (éditables en form). */
export const COMPANY_63 = {
  societeNom: "63 AGENCY",
  societeRc: "162821",
  societeCnie: "BE925205",
  societeIce: "003071765000061",
  societeTp: "32401025",
  societeAdresse: "179 Bd La resistance, CASABLANCA, Maroc",
  societeTelephone: "+212 6 06 67 67 10",
  societeEmail: "Contact@63agency.ma",
} as const;

/** Mentions fiscales / TVA par défaut */
export const DEVIS_DEFAULTS = {
  tvaTaux: 20,
  mentionTva: "TVA 20 %",
  /** Paiement — à compléter si besoin (vides par défaut) */
  paiementMode: "",
  paiementBanque: "",
  paiementTitulaire: "",
  paiementRib: "",
} as const;
