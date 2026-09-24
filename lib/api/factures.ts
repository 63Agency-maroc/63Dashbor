import { api } from "@/lib/api/client";
import {
  downloadBlob,
  fetchPdfBlob,
  type Document,
  type DocumentListItem,
  type SendDocumentEmailDto,
  type SendDocumentEmailResponse,
  type UpsertDocumentDto,
} from "@/lib/api/documents";

export type {
  DocumentTotals as FactureTotals,
  DocumentLigne as FactureLigne,
  UpsertDocumentLigneDto as UpsertFactureLigneDto,
} from "@/lib/api/documents";

export type FactureListItem = DocumentListItem;
export type Facture = Document;
export type UpsertFactureDto = UpsertDocumentDto;
export type SendFactureEmailDto = SendDocumentEmailDto;
export type SendFactureEmailResponse = SendDocumentEmailResponse;

/** Body optionnel POST /factures/from-devis/:devisId */
export type FromDevisTransferDto = Record<string, unknown>;

export function getFactures() {
  return api.get<{ items: FactureListItem[] }>("/factures");
}

export function getFactureById(id: string) {
  return api.get<Facture>(`/factures/${encodeURIComponent(id)}`);
}

export function createFacture(dto: UpsertFactureDto) {
  return api.post<Facture>("/factures", dto);
}

export function updateFacture(id: string, dto: UpsertFactureDto) {
  return api.patch<Facture>(`/factures/${encodeURIComponent(id)}`, dto);
}

export function deleteFacture(id: string) {
  return api.delete<{ message?: string; id?: string }>(`/factures/${encodeURIComponent(id)}`);
}

export function createFromDevis(devisId: string, body: FromDevisTransferDto = {}) {
  return api.post<Facture>(`/factures/from-devis/${encodeURIComponent(devisId)}`, body);
}

export function sendFactureEmail(id: string, dto: SendFactureEmailDto) {
  return api.post<SendFactureEmailResponse>(
    `/factures/${encodeURIComponent(id)}/send-email`,
    dto,
  );
}

/** GET /factures/:id/pdf — stream PDF avec JWT → Blob */
export function getFacturePdfBlob(id: string): Promise<Blob> {
  return fetchPdfBlob(`/factures/${encodeURIComponent(id)}/pdf`);
}

export { downloadBlob };
