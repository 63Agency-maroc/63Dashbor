import { api } from "@/lib/api/client";

/** Contrat API Clients — camelCase exact */
export type Client = {
  id: string;
  clientNom: string;
  clientEmail: string;
  clientTelephone: string;
  clientIce: string;
};

/** Body écriture — PATCH remplace les 4 champs (pas de merge partiel) */
export type ClientWriteDto = {
  clientNom: string;
  clientEmail?: string;
  clientTelephone?: string;
  clientIce?: string;
};

type ClientsListResponse = {
  items: Client[];
};

type DeleteClientResponse = {
  message: string;
  id: string;
};

export async function getClients(): Promise<Client[]> {
  const res = await api.get<ClientsListResponse>("/clients");
  return Array.isArray(res?.items) ? res.items : [];
}

export function createClient(dto: ClientWriteDto) {
  return api.post<Client>("/clients", dto);
}

/** Envoyer TOUJOURS les 4 champs — le PATCH API remplace, il ne merge pas. */
export function updateClient(id: string, dto: Required<ClientWriteDto>) {
  return api.patch<Client>(`/clients/${id}`, dto);
}

export function deleteClient(id: string) {
  return api.delete<DeleteClientResponse>(`/clients/${id}`);
}
