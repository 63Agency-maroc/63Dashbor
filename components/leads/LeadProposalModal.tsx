"use client";

import { useMemo } from "react";
import { generateLeadProposalPdf } from "@/lib/api/leads";
import { BrandedProposalModal } from "@/components/proposals/BrandedProposalModal";
import type { BrandedProposalPdfDto } from "@/lib/proposals/brandedPdf";

type Props = {
  open: boolean;
  leadId: string;
  leadName?: string | null;
  onClose: () => void;
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

/** Modal lead : POST /leads/:id/proposal/pdf */
export function LeadProposalModal({
  open,
  leadId,
  leadName,
  onClose,
  onToast,
}: Props) {
  const initial = useMemo(
    () => ({ client: (leadName ?? "").trim() }),
    [leadName],
  );

  return (
    <BrandedProposalModal
      open={open}
      initial={initial}
      title="Générer une proposition"
      onClose={onClose}
      onToast={onToast}
      generatePdf={(dto: BrandedProposalPdfDto) => generateLeadProposalPdf(leadId, dto)}
    />
  );
}
