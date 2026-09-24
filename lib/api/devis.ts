import { api } from "@/lib/api/client";
import {
  computeLocalTotals,
  downloadBlob,
  fetchPdfBlob,
  type Document,
  type DocumentListItem,
  type DocumentStatus,
  type DocumentTotals,
  type SendDocumentEmailDto,
  type SendDocumentEmailResponse,
  type UpsertDocumentDto,
  type UpsertDocumentLigneDto,
} from "@/lib/api/documents";

export type DevisStatus = DocumentStatus;
export type DevisTotals = DocumentTotals;
export type DevisLigne = Document["lignes"][number];
export type DevisListItem = DocumentListItem;
export type Devis = Document;
export type UpsertDevisLigneDto = UpsertDocumentLigneDto;
export type UpsertDevisDto = UpsertDocumentDto;
export type SendDevisEmailDto = SendDocumentEmailDto;
export type SendDevisEmailResponse = SendDocumentEmailResponse;

export type FromDevisTransferDto = Record<string, unknown>;

/** Facture créée par transfert — forme minimale */
export type FactureFromTransfer = {
  id: string;
  numero?: string;
  [key: string]: unknown;
};

export function getDevis() {
  return api.get<{ items: DevisListItem[] }>("/devis");
}

export function getDevisById(id: string) {
  return api.get<Devis>(`/devis/${encodeURIComponent(id)}`);
}

export function createDevis(dto: UpsertDevisDto) {
  return api.post<Devis>("/devis", dto);
}

export function updateDevis(id: string, dto: UpsertDevisDto) {
  return api.patch<Devis>(`/devis/${encodeURIComponent(id)}`, dto);
}

export function deleteDevis(id: string) {
  return api.delete<{ message?: string; id?: string }>(`/devis/${encodeURIComponent(id)}`);
}

export function transferToFacture(id: string, body: FromDevisTransferDto = {}) {
  return api.post<FactureFromTransfer>(
    `/devis/${encodeURIComponent(id)}/transfer-to-facture`,
    body,
  );
}

export function sendDevisEmail(id: string, dto: SendDevisEmailDto) {
  return api.post<SendDevisEmailResponse>(`/devis/${encodeURIComponent(id)}/send-email`, dto);
}

/** GET /devis/:id/pdf — stream PDF avec JWT → Blob */
export function getDevisPdfBlob(id: string): Promise<Blob> {
  return fetchPdfBlob(`/devis/${encodeURIComponent(id)}/pdf`);
}

export { downloadBlob, computeLocalTotals };
