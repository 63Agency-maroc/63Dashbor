"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  getPropositionById,
  propositionToUpsert,
  sanitizeUpsertDto,
  updateProposition,
  type UpsertPropositionDto,
} from "@/lib/api/propositions";
import { AppToast } from "@/components/clients/AppToast";
import { PropositionForm } from "@/components/propositions/PropositionForm";

export default function EditPropositionPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();

  const [initial, setInitial] = useState<UpsertPropositionDto | null>(null);
  const [numero, setNumero] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" } | null>(
    null,
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setForbidden(false);
    void getPropositionById(id)
      .then((p) => {
        if (cancelled) return;
        setNumero(p.numero ?? "");
        setInitial(propositionToUpsert(p));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          return;
        }
        setLoadError(err instanceof ApiError ? err.message : "Impossible de charger la proposition.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(values: UpsertPropositionDto) {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      // PATCH = replace : envoyer toute la structure
      await updateProposition(id, sanitizeUpsertDto(values));
      setToast({ message: "Proposition mise à jour.", variant: "success" });
      window.setTimeout(() => router.push("/propositions"), 600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  if (forbidden) {
    return (
      <div className="container-fluid">
        <div className="card mt-3">
          <div className="card-body text-center py-5">
            <h5 className="mb-2">Accès non autorisé</h5>
            <p className="text-muted mb-0">Réservé aux administrateurs.</p>
          </div>
        </div>
      </div>
    );
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
              Éditer
            </li>
          </ol>
        </nav>
      </div>

      <div className="mb-3">
        <h4 className="mb-1">Éditer {numero || "proposition"}</h4>
        <p className="text-muted mb-0 small">
          PATCH replace : toute la structure est renvoyée à l&apos;enregistrement.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : loadError && !initial ? (
        <div className="alert alert-danger" role="alert">
          {loadError}
        </div>
      ) : initial ? (
        <>
          {loadError ? (
            <div className="alert alert-warning" role="alert">
              {loadError}
            </div>
          ) : null}
          <PropositionForm
            initial={initial}
            submitting={submitting}
            error={error}
            submitLabel="Enregistrer"
            onCancel={() => router.push("/propositions")}
            onSubmit={(dto) => void handleSubmit(dto)}
          />
        </>
      ) : null}
    </div>
  );
}
