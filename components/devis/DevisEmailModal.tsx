"use client";

import { DocumentEmailModal } from "@/components/documents/DocumentEmailModal";

type Props = {
  open: boolean;
  numero: string;
  defaultTo: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { to: string; subject: string; message: string }) => void;
};

/** Wrapper Devis → DocumentEmailModal partagé */
export function DevisEmailModal(props: Props) {
  return <DocumentEmailModal {...props} kind="devis" />;
}
