"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { downloadBlob } from "@/lib/api/documents";
import { type UpsertPropositionDto } from "@/lib/api/propositions";
import type { Lead } from "@/lib/api/leads";
import { useLeadSuggestions } from "@/hooks/useLeadSuggestions";
import {
  applyBrandedToUpsert,
  brandedInitialFromProposition,
  brandedProposalFilename,
  emptyBrandedProposalForm,
  withProposalLanguage,
  type BrandedProposalPdfDto,
  type ProposalPdfLanguage,
} from "@/lib/proposals/brandedPdf";

type Props = {
  initial: UpsertPropositionDto;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (dto: UpsertPropositionDto) => void;
  onCancel: () => void;
  generatePdf?: (dto: BrandedProposalPdfDto) => Promise<Blob>;
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

export function PropositionForm({
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  generatePdf,
  onToast,
}: Props) {
  const [base, setBase] = useState<UpsertPropositionDto>(initial);
  const [form, setForm] = useState<BrandedProposalPdfDto>(() =>
    emptyBrandedProposalForm(brandedInitialFromProposition(initial)),
  );
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [leadSuggestOpen, setLeadSuggestOpen] = useState(false);
  const { items: leadSuggestions, busy: leadSearchBusy, clear: clearLeadSuggestions } =
    useLeadSuggestions(form.client, leadSuggestOpen);

  useEffect(() => {
    setBase(initial);
    setForm(emptyBrandedProposalForm(brandedInitialFromProposition(initial)));
    setLeadSuggestOpen(false);
    setPdfError(null);
    clearLeadSuggestions();
  }, [initial, clearLeadSuggestions]);

  function patch<K extends keyof BrandedProposalPdfDto>(
    key: K,
    value: BrandedProposalPdfDto[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setLanguage(language: ProposalPdfLanguage) {
    setForm((prev) => withProposalLanguage(prev, language));
  }

  function pickLead(lead: Lead) {
    const name = (lead.name || "").trim();
    const email = (lead.email || "").trim();
    const phone = (lead.phone || "").trim();
    setForm((prev) => ({ ...prev, client: name || prev.client }));
    setBase((prev) => ({
      ...prev,
      clientNom: name || prev.clientNom,
      clientEmail: email || prev.clientEmail,
      clientTelephone: phone || prev.clientTelephone,
      preparePour: name || prev.preparePour,
      nomEtablissement: name || prev.nomEtablissement,
    }));
    setLeadSuggestOpen(false);
    clearLeadSuggestions();
  }

  function toUpsert(): UpsertPropositionDto {
    return applyBrandedToUpsert(base, form);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(toUpsert());
  }

  async function runGenerate(mode: "download" | "preview") {
    if (!generatePdf || pdfBusy || submitting) return;
    const dto = emptyBrandedProposalForm(form);
    if (!dto.client.trim()) {
      setPdfError("Le client est requis.");
      return;
    }
    setPdfBusy(true);
    setPdfError(null);
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
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Impossible de générer le PDF.";
      setPdfError(msg);
      onToast?.(msg, "danger");
    } finally {
      setPdfBusy(false);
    }
  }

  const busy = submitting || pdfBusy;

  return (
    <form className="doc-form doc-form--page" onSubmit={handleSubmit}>
      {error ? (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="fi fi-rr-exclamation mt-1" aria-hidden />
          <div>
            <div className="fw-semibold mb-0">Impossible d’enregistrer</div>
            <div className="mb-0">{error}</div>
          </div>
        </div>
      ) : null}

      <div className="doc-form__section-card card mb-3">
        <div className="card-body">
          <p className="text-muted small mb-3">
            Les champs sont préremplis et modifiables. Le PDF est généré côté serveur.
          </p>

          <div className="row g-3">
            <div
              className={`col-md-8 doc-form__field--suggest${
                leadSuggestOpen && leadSuggestions.length > 0 ? " is-open" : ""
              }`}
            >
              <label className="form-label" htmlFor="prop-client">
                Client <span className="text-danger">*</span>
              </label>
              <div className="position-relative">
                <input
                  id="prop-client"
                  className="form-control"
                  value={form.client}
                  disabled={busy}
                  required
                  autoComplete="off"
                  placeholder="Tapez un nom pour chercher dans les leads…"
                  onChange={(e) => {
                    setLeadSuggestOpen(true);
                    patch("client", e.target.value);
                  }}
                  onFocus={() => {
                    if (form.client.trim().length >= 2) setLeadSuggestOpen(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setLeadSuggestOpen(false), 150);
                  }}
                />
                {leadSearchBusy ? <div className="form-text">Recherche leads…</div> : null}
                {leadSuggestOpen && leadSuggestions.length > 0 ? (
                  <ul className="doc-form__suggest list-group" role="listbox">
                    {leadSuggestions.map((lead) => (
                      <li key={lead.id} role="option">
                        <button
                          type="button"
                          className="list-group-item list-group-item-action"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickLead(lead);
                          }}
                        >
                          <span className="fw-medium text-truncate d-block">{lead.name}</span>
                          <span className="small text-muted text-truncate d-block">
                            {[lead.email, lead.phone, lead.status].filter(Boolean).join(" · ") ||
                              "Lead"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="prop-date">
                Date <span className="text-danger">*</span>
              </label>
              <input
                id="prop-date"
                className="form-control"
                value={form.date}
                disabled={busy}
                required
                placeholder="NOV 2026"
                onChange={(e) => patch("date", e.target.value)}
              />
            </div>

            <div className="col-12">
              <label className="form-label d-block">Langue du PDF</label>
              <div className="btn-group" role="group" aria-label="Langue du PDF">
                <button
                  type="button"
                  className={`btn ${form.language === "fr" ? "btn-primary" : "btn-outline-primary"}`}
                  disabled={busy}
                  aria-pressed={form.language === "fr"}
                  onClick={() => setLanguage("fr")}
                >
                  Français
                </button>
                <button
                  type="button"
                  className={`btn ${form.language === "en" ? "btn-primary" : "btn-outline-primary"}`}
                  disabled={busy}
                  aria-pressed={form.language === "en"}
                  onClick={() => setLanguage("en")}
                >
                  English
                </button>
              </div>
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="prop-offer">
                Offre <span className="text-danger">*</span>
              </label>
              <input
                id="prop-offer"
                className="form-control"
                value={form.offerName}
                disabled={busy}
                required
                onChange={(e) => patch("offerName", e.target.value)}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="prop-price">
                Prix <span className="text-danger">*</span>
              </label>
              <input
                id="prop-price"
                className="form-control"
                value={form.price}
                disabled={busy}
                required
                onChange={(e) => patch("price", e.target.value)}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="prop-currency">
                Devise <span className="text-danger">*</span>
              </label>
              <input
                id="prop-currency"
                className="form-control"
                value={form.currency}
                disabled={busy}
                required
                onChange={(e) => patch("currency", e.target.value)}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="prop-period">
                Période <span className="text-danger">*</span>
              </label>
              <input
                id="prop-period"
                className="form-control"
                value={form.period}
                disabled={busy}
                required
                onChange={(e) => patch("period", e.target.value)}
              />
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="prop-adbudget">
                Budget pub <span className="text-danger">*</span>
              </label>
              <textarea
                id="prop-adbudget"
                className="form-control"
                rows={3}
                value={form.adBudget}
                disabled={busy}
                required
                onChange={(e) => patch("adBudget", e.target.value)}
              />
            </div>
          </div>

          {pdfError ? (
            <div className="alert alert-danger mt-3 mb-0 py-2" role="alert">
              {pdfError}
            </div>
          ) : null}
        </div>
      </div>

      <div className="doc-form__footer doc-form__footer--page flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Annuler
        </button>
        {generatePdf ? (
          <>
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={busy}
              onClick={() => void runGenerate("preview")}
            >
              {pdfBusy ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Génération…
                </>
              ) : (
                "Prévisualiser"
              )}
            </button>
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={busy}
              onClick={() => void runGenerate("download")}
            >
              Générer le PDF
            </button>
          </>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" /> Enregistrement…
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
