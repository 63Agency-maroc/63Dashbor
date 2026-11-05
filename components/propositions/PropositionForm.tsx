"use client";

import { FormEvent, useEffect, useState } from "react";
import { type UpsertPropositionDto } from "@/lib/api/propositions";
import type { Lead } from "@/lib/api/leads";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";
import { useLeadSuggestions } from "@/hooks/useLeadSuggestions";

type Props = {
  initial: UpsertPropositionDto;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (dto: UpsertPropositionDto) => void;
  onCancel: () => void;
  /** Ouvre le PDF marque 63 avec les valeurs courantes du formulaire */
  onBrandedPdf?: (values: UpsertPropositionDto) => void;
};

export function PropositionForm({
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  onBrandedPdf,
}: Props) {
  const [form, setForm] = useState<UpsertPropositionDto>(initial);
  const [leadSuggestOpen, setLeadSuggestOpen] = useState(false);
  const { items: leadSuggestions, busy: leadSearchBusy, clear: clearLeadSuggestions } =
    useLeadSuggestions(form.clientNom, leadSuggestOpen);

  useEffect(() => {
    setForm(initial);
    setLeadSuggestOpen(false);
    clearLeadSuggestions();
  }, [initial, clearLeadSuggestions]);

  function pickLead(lead: Lead) {
    const name = (lead.name || "").trim();
    const email = (lead.email || "").trim();
    const phone = (lead.phone || "").trim();
    setForm((prev) => ({
      ...prev,
      clientNom: name || prev.clientNom,
      clientEmail: email || prev.clientEmail,
      clientTelephone: phone || prev.clientTelephone,
      preparePour: prev.preparePour || name,
      nomEtablissement: prev.nomEtablissement || name,
    }));
    setLeadSuggestOpen(false);
    clearLeadSuggestions();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

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
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label" htmlFor="clientNom">
                Client <span className="text-danger">*</span>
              </label>
              <div className="position-relative">
                <input
                  id="clientNom"
                  className="form-control"
                  value={form.clientNom}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLeadSuggestOpen(true);
                    setForm((p) => ({
                      ...p,
                      clientNom: value,
                      preparePour: p.preparePour === p.clientNom ? value : p.preparePour,
                    }));
                  }}
                  onFocus={() => {
                    if (form.clientNom.trim().length >= 2) setLeadSuggestOpen(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setLeadSuggestOpen(false), 150);
                  }}
                  placeholder="Tapez un nom pour chercher dans les leads…"
                  required
                  disabled={submitting}
                  autoComplete="off"
                />
                {leadSearchBusy ? <div className="form-text">Recherche leads…</div> : null}
                {leadSuggestOpen && leadSuggestions.length > 0 ? (
                  <ul
                    className="list-group position-absolute w-100 shadow-sm"
                    style={{ zIndex: 20, maxHeight: 220, overflowY: "auto" }}
                  >
                    {leadSuggestions.map((lead) => (
                      <li key={lead.id}>
                        <button
                          type="button"
                          className="list-group-item list-group-item-action"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickLead(lead);
                          }}
                        >
                          <span className="fw-medium">{lead.name}</span>
                          <span className="small text-muted d-block">
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
              <label className="form-label" htmlFor="dateEmission">
                Date <span className="text-danger">*</span>
              </label>
              <CasablancaDatePicker
                id="dateEmission"
                value={form.dateEmission}
                onChange={(ymd) => setForm((p) => ({ ...p, dateEmission: ymd }))}
                disabled={submitting}
              />
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="titreProposition">
                Offre <span className="text-danger">*</span>
              </label>
              <input
                id="titreProposition"
                className="form-control"
                value={form.titreProposition}
                onChange={(e) => setForm((p) => ({ ...p, titreProposition: e.target.value }))}
                placeholder="Ex. Partenariat de 3 mois"
                required
                disabled={submitting}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="doc-form__footer doc-form__footer--page">
        <button type="button" className="doc-form__btn doc-form__btn--ghost" onClick={onCancel} disabled={submitting}>
          Annuler
        </button>
        {onBrandedPdf ? (
          <button
            type="button"
            className="doc-form__btn doc-form__btn--ghost"
            disabled={submitting}
            onClick={() => onBrandedPdf(form)}
          >
            <i className="fi fi-rr-document me-1" aria-hidden />
            Proposition 63
          </button>
        ) : null}
        <button type="submit" className="doc-form__btn doc-form__btn--primary" disabled={submitting}>
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
