import { ApiError } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";
import { getToken } from "@/lib/auth/storage";

/** Types partagés devis / factures (contrat API identique hors préfixe numéro). */

export type DocumentStatus = "draft" | string;

export type DocumentLigne = {
  id?: string;
  titre: string;
  description: string;
  quantite: number;
  prixUnitaireHt: number;
  /** Calculé backend — ne pas envoyer en upsert */
  totalLigneHt?: number;
};

export type DocumentTotals = {
  totalHt: number;
  montantTva: number;
  totalTtc: number;
};

export type DocumentListItem = {
  id: string;
  numero: string;
  status: DocumentStatus;
  clientNom: string;
  clientIce?: string | null;
  clientEmail?: string | null;
  clientTelephone?: string | null;
  dateEmission: string;
  totals: { totalTtc: number };
};

export type Document = {
  id: string;
  numero: string;
  status: DocumentStatus;
  societeNom: string;
  societeRc: string;
  societeCnie: string;
  societeIce: string;
  societeTp: string;
  societeAdresse: string;
  societeTelephone: string;
  societeEmail: string;
  clientNom: string;
  clientIce?: string | null;
  clientEmail?: string | null;
  clientTelephone?: string | null;
  dateEmission: string;
  lignes: DocumentLigne[];
  tvaTaux: number;
  mentionTva: string;
  paiementMode: string;
  paiementBanque: string;
  paiementTitulaire: string;
  paiementRib: string;
  totals: DocumentTotals;
  createdAt: string;
  updatedAt: string;
};

export type UpsertDocumentLigneDto = {
  titre: string;
  description: string;
  quantite: number;
  prixUnitaireHt: number;
};

/** POST/PATCH — REPLACE tout (mêmes champs devis & factures) */
export type UpsertDocumentDto = {
  societeNom: string;
  societeRc: string;
  societeCnie: string;
  societeIce: string;
  societeTp: string;
  societeAdresse: string;
  societeTelephone: string;
  societeEmail: string;
  clientNom: string;
  clientIce?: string;
  clientEmail?: string;
  clientTelephone?: string;
  dateEmission: string;
  lignes: UpsertDocumentLigneDto[];
  tvaTaux: number;
  mentionTva: string;
  paiementMode: string;
  paiementBanque: string;
  paiementTitulaire: string;
  paiementRib: string;
};

export type SendDocumentEmailDto = {
  to: string;
  subject: string;
  message: string;
};

export type SendDocumentEmailResponse = {
  success: boolean;
  messageId?: string;
  sentAt?: string;
};

export type DocumentKind = "devis" | "facture";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** GET …/pdf — stream PDF avec JWT → Blob */
export async function fetchPdfBlob(path: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `PDF indisponible (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") {
        message = (data as { message: string }).message;
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return res.blob();
}

/** Totaux locaux (aperçu) — le backend fait foi */
export function computeLocalTotals(
  lignes: { quantite: number; prixUnitaireHt: number }[],
  tvaTaux: number,
): DocumentTotals & { lignesHt: number[] } {
  const lignesHt = lignes.map((l) => {
    const q = Number(l.quantite) || 0;
    const p = Number(l.prixUnitaireHt) || 0;
    return Math.round(q * p * 100) / 100;
  });
  const totalHt = Math.round(lignesHt.reduce((s, v) => s + v, 0) * 100) / 100;
  const taux = Number(tvaTaux) || 0;
  const montantTva = Math.round(totalHt * (taux / 100) * 100) / 100;
  const totalTtc = Math.round((totalHt + montantTva) * 100) / 100;
  return { totalHt, montantTva, totalTtc, lignesHt };
}
