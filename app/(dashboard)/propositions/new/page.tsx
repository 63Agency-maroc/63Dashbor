"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  createProposition,
  emptyUpsertProposition,
  sanitizeUpsertDto,
  type UpsertPropositionDto,
} from "@/lib/api/propositions";
import { AppToast } from "@/components/clients/AppToast";
import { PropositionForm } from "@/components/propositions/PropositionForm";

export default function NewPropositionPage() {
  const router = useRouter();
  const initial = useMemo(() => emptyUpsertProposition(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" } | null>(
    null,
  );

  async function handleSubmit(values: UpsertPropositionDto) {
    setSubmitting(true);
    setError(null);
    try {
      await createProposition(sanitizeUpsertDto(values));
      setToast({ message: "Proposition créée.", variant: "success" });
      window.setTimeout(() => router.push("/propositions"), 600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-fluid">
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex flex-wrap gap-3 align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item">
              <Link href="/propositions">Propositions</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Nouvelle
            </li>
          </ol>
        </nav>
      </div>

      <div className="mb-3">
        <h4 className="mb-1">Nouvelle proposition</h4>
        <p className="text-muted mb-0 small">
          Remplissez les sections ci-dessous. Le numéro (PROP-…) est attribué côté serveur.
        </p>
      </div>

      <PropositionForm
        initial={initial}
        submitting={submitting}
        error={error}
        submitLabel="Créer la proposition"
        onCancel={() => router.push("/propositions")}
        onSubmit={(dto) => void handleSubmit(dto)}
      />
    </div>
  );
}
