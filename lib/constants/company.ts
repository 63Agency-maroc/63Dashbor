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

/** Lignes préremplies à la création d’un devis (qté / PU HT à compléter). */
export const DEVIS_DEFAULT_LIGNES = [
  {
    titre: "CRÉATION DE CONTENUS VIDÉOS",
    description:
      "Production de contenus vidéos adaptés à votre activité, conçus pour capter l'attention, renforcer votre image de marque et générer de l'intérêt auprès de votre audience cible.",
    quantite: 0,
    prixUnitaireHt: 0,
  },
  {
    titre: "CONCEPTION & MISE EN PLACE LE TUNNEL DE VENTE",
    description:
      "Création d'un tunnel de conversion permettant de qualifier les prospects, structurer leur parcours et maximiser les demandes réellement intéressées.",
    quantite: 0,
    prixUnitaireHt: 0,
  },
  {
    titre: "GESTION & OPTIMISATION LES CAMPAGNES PUBLICITAIRES SUR FACEBOOK ET INSTAGRAM",
    description:
      "Paramétrage, pilotage et optimisation continue des campagnes publicitaires sur les plateformes digitales afin d'atteindre des prospects qualifiés et améliorer la performance globale.",
    quantite: 0,
    prixUnitaireHt: 0,
  },
] as const;
