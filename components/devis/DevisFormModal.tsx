"use client";

import {
  DocumentFormModal,
  toUpsertDto,
  type DocumentFormValues,
} from "@/components/documents/DocumentFormModal";
import type { Devis, UpsertDevisDto } from "@/lib/api/devis";

export type { DocumentFormValues as DevisFormValues };
export { toUpsertDto };

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Devis | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (dto: UpsertDevisDto) => void;
};

/** Wrapper Devis → DocumentFormModal partagé */
export function DevisFormModal(props: Props) {
  return <DocumentFormModal {...props} kind="devis" />;
}
