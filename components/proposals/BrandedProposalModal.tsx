"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { downloadBlob } from "@/lib/api/documents";
import { Select } from "@/components/ui/Select";
import {
  brandedProposalFilename,
  emptyBrandedProposalForm,
  PROPOSAL_OFFER_OPTIONS,
  proposalOfferLabel,
  resolveProposalOfferId,
  withProposalLanguage,
  type BrandedProposalPdfDto,
  type ProposalOfferId,
  type ProposalPdfLanguage,
} from "@/lib/proposals/brandedPdf";

const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

type Props = {
  open: boolean;
  /** Prefill when the modal opens (merged with defaults). */
  initial?: Partial<BrandedProposalPdfDto> | null;
  /** POST that returns the PDF blob. */
  generatePdf: (dto: BrandedProposalPdfDto) => Promise<Blob>;
  title?: string;
  onClose: () => void;
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

export function BrandedProposalModal({
  open,
  initial,
  generatePdf,
  title = "Générer une proposition",
  onClose,
  onToast,
}: Props) {
  const [form, setForm] = useState(() => emptyBrandedProposalForm(initial ?? undefined));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyBrandedProposalForm(initial ?? undefined));
    setError(null);
    setBusy(false);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  function patch<K extends keyof BrandedProposalPdfDto>(
    key: K,
    value: BrandedProposalPdfDto[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setLanguage(language: ProposalPdfLanguage) {
    setForm((prev) => withProposalLanguage(prev, language));
  }

  function dtoFromForm(): BrandedProposalPdfDto {
    return emptyBrandedProposalForm({
      client: form.client.trim(),
      date: form.date.trim(),
      offerName: form.offerName.trim(),
      price: form.price.trim(),
      currency: form.currency.trim(),
      period: form.period.trim(),
      adBudget: form.adBudget.trim(),
      language: form.language,
    });
  }

  async function runGenerate(mode: "download" | "preview") {
    if (busy) return;
    const dto = dtoFromForm();
    if (!dto.client) {
      setError("Le client est requis.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await generatePdf(dto);
      if (mode === "preview") {
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          downloadBlob(blob, brandedProposalFilename(dto.client));
          onToast?.("Aperçu bloqué — PDF téléchargé.", "info");
        } else {
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          onToast?.("Aperçu ouvert.", "success");
        }
      } else {
        downloadBlob(blob, brandedProposalFilename(dto.client));
        onToast?.("Proposition PDF générée.", "success");
        onClose();
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Impossible de générer le PDF.";
      setError(msg);
      onToast?.(msg, "danger");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runGenerate("download");
  }

  if (!open) return null;

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: "block" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="branded-proposal-modal-title"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="branded-proposal-modal-title">
                {title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Fermer"
                disabled={busy}
                onClick={onClose}
              />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <p className="text-muted small mb-3">
                  Les champs sont préremplis et modifiables. Le PDF est généré côté serveur.
                </p>

                <div className="row g-3">
                  <div className="col-md-8">
                    <label className="form-label" htmlFor="branded-prop-client">
                      Client
                    </label>
                    <input
                      id="branded-prop-client"
                      className="form-control"
                      value={form.client}
                      disabled={busy}
                      onChange={(e) => patch("client", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="branded-prop-date">
                      Date
                    </label>
                    <input
                      id="branded-prop-date"
                      className="form-control"
                      value={form.date}
                      readOnly
                      disabled={busy}
                      required
                      aria-describedby="branded-prop-date-hint"
                    />
                    <div id="branded-prop-date-hint" className="form-text">
                      Mois et année de création (automatique)
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="branded-prop-language">
                      Langue du PDF
                    </label>
                    <Select
                      id="branded-prop-language"
                      className="doc-form__app-select"
                      value={form.language ?? "fr"}
                      disabled={busy}
                      required
                      aria-label="Langue du PDF"
                      options={LANGUAGE_OPTIONS}
                      onChange={(value) => setLanguage(value === "en" ? "en" : "fr")}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="branded-prop-offer">
                      Offre
                    </label>
                    <Select
                      id="branded-prop-offer"
                      className="doc-form__app-select"
                      value={resolveProposalOfferId(form.offerName)}
                      disabled={busy}
                      required
                      aria-label="Offre"
                      options={PROPOSAL_OFFER_OPTIONS.map((opt) => ({
                        value: opt.id,
                        label: opt[form.language ?? "fr"],
                      }))}
                      onChange={(value) =>
                        patch(
                          "offerName",
                          proposalOfferLabel(value as ProposalOfferId, form.language ?? "fr"),
                        )
                      }
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="branded-prop-price">
                      Prix
                    </label>
                    <input
                      id="branded-prop-price"
                      className="form-control"
                      value={form.price}
                      disabled={busy}
                      onChange={(e) => patch("price", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="branded-prop-currency">
                      Devise
                    </label>
                    <input
                      id="branded-prop-currency"
                      className="form-control"
                      value={form.currency}
                      disabled={busy}
                      onChange={(e) => patch("currency", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="branded-prop-period">
                      Période
                    </label>
                    <input
                      id="branded-prop-period"
                      className="form-control"
                      value={form.period}
                      disabled={busy}
                      onChange={(e) => patch("period", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="branded-prop-adbudget">
                      Budget pub
                    </label>
                    <textarea
                      id="branded-prop-adbudget"
                      className="form-control"
                      rows={3}
                      value={form.adBudget}
                      disabled={busy}
                      onChange={(e) => patch("adBudget", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error ? (
                  <div className="alert alert-danger mt-3 mb-0 py-2" role="alert">
                    {error}
                  </div>
                ) : null}
              </div>
              <div className="modal-footer flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-light"
                  disabled={busy}
                  onClick={onClose}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  disabled={busy}
                  onClick={() => void runGenerate("preview")}
                >
                  {busy ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Génération…
                    </>
                  ) : (
                    "Prévisualiser"
                  )}
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Génération…
                    </>
                  ) : (
                    "Générer le PDF"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={busy ? undefined : onClose} />
    </>
  );
}
