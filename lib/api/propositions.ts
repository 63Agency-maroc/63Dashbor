import { api } from "@/lib/api/client";
import { downloadBlob, fetchPdfBlob } from "@/lib/api/documents";
import { COMPANY_63 } from "@/lib/constants/company";

export type PropositionStatus = "draft" | string;

export type PropositionEmetteur = {
  societeNom: string;
  societeRc: string;
  societeCnie: string;
  societeIce: string;
  societeTp: string;
  societeAdresse: string;
  societeTelephone: string;
  societeEmail: string;
};

export type PropositionIntroduction = {
  paragraphe1: string;
  paragraphe2: string;
  objectifProspects: number;
};

export type StrategieSection1 = {
  description: string;
  videosMin: number;
  videosMax: number;
  topics: string[];
};

export type CampagneBloc = {
  titre: string;
  intro: string;
  points: string[];
};

export type StrategieSection2 = {
  intro: string;
  approcheIntro: string;
  blocs: CampagneBloc[];
  conclusion: string;
};

export type StrategieSection3 = {
  intro: string;
  criteres: string[];
  conclusion: string;
};

export type StrategieSection4 = {
  points: string[];
  objectif: string;
};

export type PropositionStrategie = {
  section1CreationContenu: StrategieSection1;
  section2CampagnesPublicitaires: StrategieSection2;
  section3FunnelMarketing: StrategieSection3;
  section4Automatisation: StrategieSection4;
};

export type TarifLigne = {
  service: string;
  detail: string;
  prixInitial: string;
  prixOffert: string;
};

export type PropositionTarifs = {
  lignes: TarifLigne[];
  noteMetaAds: string;
};

export type PropositionContact = {
  nom: string;
  telephone: string;
  email: string;
  tagline: string;
};

/** Proposition complète GET /propositions/:id */
export type Proposition = {
  id: string;
  numero: string;
  status: PropositionStatus;
  titreProposition: string;
  preparePour: string;
  clientNom: string;
  nomEtablissement: string;
  preparePar: string;
  dateEmission: string;
  clientIce: string;
  clientEmail: string;
  clientTelephone: string;
  emetteur: PropositionEmetteur;
  introduction: PropositionIntroduction;
  strategie: PropositionStrategie;
  tarifs: PropositionTarifs;
  pourquoiChoisir: string[];
  prochainesEtapes: string;
  contact: PropositionContact;
  createdAt: string;
  updatedAt: string;
};

/** Élément de liste — GET /propositions renvoie un ARRAY brut */
export type PropositionListItem = Pick<
  Proposition,
  | "id"
  | "numero"
  | "status"
  | "titreProposition"
  | "clientNom"
  | "nomEtablissement"
  | "dateEmission"
  | "clientEmail"
  | "clientTelephone"
>;

/** POST / PATCH — REPLACE tout (numéro + status gérés backend) */
export type UpsertPropositionDto = {
  titreProposition: string;
  preparePour: string;
  clientNom: string;
  nomEtablissement: string;
  preparePar: string;
  dateEmission: string;
  clientIce?: string;
  clientEmail?: string;
  clientTelephone?: string;
  emetteur: PropositionEmetteur;
  introduction: PropositionIntroduction;
  strategie: PropositionStrategie;
  tarifs: PropositionTarifs;
  pourquoiChoisir: string[];
  prochainesEtapes: string;
  contact: PropositionContact;
};

export type SendPropositionEmailDto = {
  to: string;
  subject: string;
  message: string;
};

export type SendPropositionEmailResponse = {
  success: boolean;
  messageId?: string;
  sentAt?: string;
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyEmetteur(): PropositionEmetteur {
  return { ...COMPANY_63 };
}

export function emptyUpsertProposition(): UpsertPropositionDto {
  return {
    titreProposition: "",
    preparePour: "",
    clientNom: "",
    nomEtablissement: "",
    preparePar: "63 Agency",
    dateEmission: todayYmd(),
    clientIce: "",
    clientEmail: "",
    clientTelephone: "",
    emetteur: emptyEmetteur(),
    introduction: {
      paragraphe1: "",
      paragraphe2: "",
      objectifProspects: 0,
    },
    strategie: {
      section1CreationContenu: {
        description: "",
        videosMin: 0,
        videosMax: 0,
        topics: [""],
      },
      section2CampagnesPublicitaires: {
        intro: "",
        approcheIntro: "",
        blocs: [{ titre: "", intro: "", points: [""] }],
        conclusion: "",
      },
      section3FunnelMarketing: {
        intro: "",
        criteres: [""],
        conclusion: "",
      },
      section4Automatisation: {
        points: [""],
        objectif: "",
      },
    },
    tarifs: {
      lignes: [{ service: "", detail: "", prixInitial: "", prixOffert: "" }],
      noteMetaAds: "",
    },
    pourquoiChoisir: [""],
    prochainesEtapes: "",
    contact: {
      nom: "63 Agency",
      telephone: COMPANY_63.societeTelephone,
      email: COMPANY_63.societeEmail,
      tagline: "",
    },
  };
}

export function propositionToUpsert(p: Proposition): UpsertPropositionDto {
  return {
    titreProposition: p.titreProposition ?? "",
    preparePour: p.preparePour ?? "",
    clientNom: p.clientNom ?? "",
    nomEtablissement: p.nomEtablissement ?? "",
    preparePar: p.preparePar ?? "63 Agency",
    dateEmission: p.dateEmission || todayYmd(),
    clientIce: p.clientIce ?? "",
    clientEmail: p.clientEmail ?? "",
    clientTelephone: p.clientTelephone ?? "",
    emetteur: {
      societeNom: p.emetteur?.societeNom ?? COMPANY_63.societeNom,
      societeRc: p.emetteur?.societeRc ?? COMPANY_63.societeRc,
      societeCnie: p.emetteur?.societeCnie ?? COMPANY_63.societeCnie,
      societeIce: p.emetteur?.societeIce ?? COMPANY_63.societeIce,
      societeTp: p.emetteur?.societeTp ?? COMPANY_63.societeTp,
      societeAdresse: p.emetteur?.societeAdresse ?? COMPANY_63.societeAdresse,
      societeTelephone: p.emetteur?.societeTelephone ?? COMPANY_63.societeTelephone,
      societeEmail: p.emetteur?.societeEmail ?? COMPANY_63.societeEmail,
    },
    introduction: {
      paragraphe1: p.introduction?.paragraphe1 ?? "",
      paragraphe2: p.introduction?.paragraphe2 ?? "",
      objectifProspects: Number(p.introduction?.objectifProspects) || 0,
    },
    strategie: {
      section1CreationContenu: {
        description: p.strategie?.section1CreationContenu?.description ?? "",
        videosMin: Number(p.strategie?.section1CreationContenu?.videosMin) || 0,
        videosMax: Number(p.strategie?.section1CreationContenu?.videosMax) || 0,
        topics:
          p.strategie?.section1CreationContenu?.topics?.length > 0
            ? [...p.strategie.section1CreationContenu.topics]
            : [""],
      },
      section2CampagnesPublicitaires: {
        intro: p.strategie?.section2CampagnesPublicitaires?.intro ?? "",
        approcheIntro: p.strategie?.section2CampagnesPublicitaires?.approcheIntro ?? "",
        blocs:
          p.strategie?.section2CampagnesPublicitaires?.blocs?.length > 0
            ? p.strategie.section2CampagnesPublicitaires.blocs.map((b) => ({
                titre: b.titre ?? "",
                intro: b.intro ?? "",
                points: b.points?.length > 0 ? [...b.points] : [""],
              }))
            : [{ titre: "", intro: "", points: [""] }],
        conclusion: p.strategie?.section2CampagnesPublicitaires?.conclusion ?? "",
      },
      section3FunnelMarketing: {
        intro: p.strategie?.section3FunnelMarketing?.intro ?? "",
        criteres:
          p.strategie?.section3FunnelMarketing?.criteres?.length > 0
            ? [...p.strategie.section3FunnelMarketing.criteres]
            : [""],
        conclusion: p.strategie?.section3FunnelMarketing?.conclusion ?? "",
      },
      section4Automatisation: {
        points:
          p.strategie?.section4Automatisation?.points?.length > 0
            ? [...p.strategie.section4Automatisation.points]
            : [""],
        objectif: p.strategie?.section4Automatisation?.objectif ?? "",
      },
    },
    tarifs: {
      lignes:
        p.tarifs?.lignes?.length > 0
          ? p.tarifs.lignes.map((l) => ({
              service: l.service ?? "",
              detail: l.detail ?? "",
              prixInitial: l.prixInitial ?? "",
              prixOffert: l.prixOffert ?? "",
            }))
          : [{ service: "", detail: "", prixInitial: "", prixOffert: "" }],
      noteMetaAds: p.tarifs?.noteMetaAds ?? "",
    },
    pourquoiChoisir: p.pourquoiChoisir?.length > 0 ? [...p.pourquoiChoisir] : [""],
    prochainesEtapes: p.prochainesEtapes ?? "",
    contact: {
      nom: p.contact?.nom ?? "63 Agency",
      telephone: p.contact?.telephone ?? COMPANY_63.societeTelephone,
      email: p.contact?.email ?? COMPANY_63.societeEmail,
      tagline: p.contact?.tagline ?? "",
    },
  };
}

/** Nettoie les listes vides avant envoi ; PATCH = replace complet */
export function sanitizeUpsertDto(values: UpsertPropositionDto): UpsertPropositionDto {
  const cleanStr = (s: string) => s.trim();
  const cleanList = (arr: string[]) => arr.map(cleanStr).filter(Boolean);

  const dto: UpsertPropositionDto = {
    titreProposition: cleanStr(values.titreProposition),
    preparePour: cleanStr(values.preparePour),
    clientNom: cleanStr(values.clientNom),
    nomEtablissement: cleanStr(values.nomEtablissement),
    preparePar: cleanStr(values.preparePar) || "63 Agency",
    dateEmission: values.dateEmission,
    emetteur: {
      societeNom: cleanStr(values.emetteur.societeNom),
      societeRc: cleanStr(values.emetteur.societeRc),
      societeCnie: cleanStr(values.emetteur.societeCnie),
      societeIce: cleanStr(values.emetteur.societeIce),
      societeTp: cleanStr(values.emetteur.societeTp),
      societeAdresse: cleanStr(values.emetteur.societeAdresse),
      societeTelephone: cleanStr(values.emetteur.societeTelephone),
      societeEmail: cleanStr(values.emetteur.societeEmail),
    },
    introduction: {
      paragraphe1: cleanStr(values.introduction.paragraphe1),
      paragraphe2: cleanStr(values.introduction.paragraphe2),
      objectifProspects: Math.max(0, Number(values.introduction.objectifProspects) || 0),
    },
    strategie: {
      section1CreationContenu: {
        description: cleanStr(values.strategie.section1CreationContenu.description),
        videosMin: Math.max(0, Number(values.strategie.section1CreationContenu.videosMin) || 0),
        videosMax: Math.max(0, Number(values.strategie.section1CreationContenu.videosMax) || 0),
        topics: cleanList(values.strategie.section1CreationContenu.topics),
      },
      section2CampagnesPublicitaires: {
        intro: cleanStr(values.strategie.section2CampagnesPublicitaires.intro),
        approcheIntro: cleanStr(values.strategie.section2CampagnesPublicitaires.approcheIntro),
        blocs: values.strategie.section2CampagnesPublicitaires.blocs.map((b) => ({
          titre: cleanStr(b.titre),
          intro: cleanStr(b.intro),
          points: cleanList(b.points),
        })),
        conclusion: cleanStr(values.strategie.section2CampagnesPublicitaires.conclusion),
      },
      section3FunnelMarketing: {
        intro: cleanStr(values.strategie.section3FunnelMarketing.intro),
        criteres: cleanList(values.strategie.section3FunnelMarketing.criteres),
        conclusion: cleanStr(values.strategie.section3FunnelMarketing.conclusion),
      },
      section4Automatisation: {
        points: cleanList(values.strategie.section4Automatisation.points),
        objectif: cleanStr(values.strategie.section4Automatisation.objectif),
      },
    },
    tarifs: {
      lignes: values.tarifs.lignes.map((l) => ({
        service: cleanStr(l.service),
        detail: cleanStr(l.detail),
        prixInitial: cleanStr(l.prixInitial),
        prixOffert: cleanStr(l.prixOffert),
      })),
      noteMetaAds: cleanStr(values.tarifs.noteMetaAds),
    },
    pourquoiChoisir: cleanList(values.pourquoiChoisir),
    prochainesEtapes: cleanStr(values.prochainesEtapes),
    contact: {
      nom: cleanStr(values.contact.nom),
      telephone: cleanStr(values.contact.telephone),
      email: cleanStr(values.contact.email),
      tagline: cleanStr(values.contact.tagline),
    },
  };

  const ice = cleanStr(values.clientIce ?? "");
  const email = cleanStr(values.clientEmail ?? "");
  const tel = cleanStr(values.clientTelephone ?? "");
  if (ice) dto.clientIce = ice;
  if (email) dto.clientEmail = email;
  if (tel) dto.clientTelephone = tel;

  return dto;
}

/**
 * GET /propositions → ARRAY brut (pas { items }).
 * Tolère aussi { items } par sécurité.
 */
export async function getPropositions(): Promise<PropositionListItem[]> {
  const res = await api.get<PropositionListItem[] | { items: PropositionListItem[] }>("/propositions");
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object" && Array.isArray((res as { items?: unknown }).items)) {
    return (res as { items: PropositionListItem[] }).items;
  }
  return [];
}

export function getPropositionById(id: string) {
  return api.get<Proposition>(`/propositions/${encodeURIComponent(id)}`);
}

export function createProposition(dto: UpsertPropositionDto) {
  return api.post<Proposition>("/propositions", dto);
}

export function updateProposition(id: string, dto: UpsertPropositionDto) {
  return api.patch<Proposition>(`/propositions/${encodeURIComponent(id)}`, dto);
}

export function deleteProposition(id: string) {
  return api.delete<{ message?: string; id?: string }>(`/propositions/${encodeURIComponent(id)}`);
}

export function sendPropositionEmail(id: string, dto: SendPropositionEmailDto) {
  return api.post<SendPropositionEmailResponse>(
    `/propositions/${encodeURIComponent(id)}/send-email`,
    dto,
  );
}

export function getPropositionPdfBlob(id: string): Promise<Blob> {
  return fetchPdfBlob(`/propositions/${encodeURIComponent(id)}/pdf`);
}

export { downloadBlob };
