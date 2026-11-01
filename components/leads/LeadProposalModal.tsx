"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { downloadBlob } from "@/lib/api/documents";
import {
  generateLeadProposalPdf,
  type LeadProposalPdfDto,
} from "@/lib/api/leads";

type Props = {
  open: boolean;
  leadId: string;
  leadName?: string | null;
  onClose: () => void;
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

const DEFAULT_OFFER = "Partenariat de 3 mois";
const DEFAULT_PRICE = "13 500,00";
const DEFAULT_CURRENCY = "DHS";
const DEFAULT_PERIOD = "PAR TRIMESTRE";
const DEFAULT_AD_BUDGET =
  "Les dépenses publicitaires restent à la charge de l’entreprise cliente, avec un budget initial minimum de 3 000 DHS/mois.";

const MONTHS_FR = [
  "JAN",
  "FÉV",
  "MAR",
  "AVR",
  "MAI",
  "JUN",
  "JUL",
  "AOÛ",
  "SEP",
  "OCT",
  "NOV",
  "DÉC",
] as const;

function defaultProposalDate(now = new Date()) {
  return `${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`;
}

function safeFilenameClient(client: string) {
  const cleaned = client.trim().replace(/[^\w.-]+/g, "_") || "Client";
  return `Proposition-${cleaned}.pdf`;
}

function emptyForm(leadName?: string | null): Required<LeadProposalPdfDto> {
  return {
    client: (leadName ?? "").trim() || "",
    date: defaultProposalDate(),
    offerName: DEFAULT_OFFER,
    price: DEFAULT_PRICE,
    currency: DEFAULT_CURRENCY,
    period: DEFAULT_PERIOD,
    adBudget: DEFAULT_AD_BUDGET,
  };
}

export function LeadProposalModal({
  open,
  leadId,
  leadName,
  onClose,
  onToast,
}: Props) {
  const [form, setForm] = useState(() => emptyForm(leadName));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(leadName));
    setError(null);
    setBusy(false);
  }, [open, leadName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  function patch<K extends keyof LeadProposalPdfDto>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function dtoFromForm(): LeadProposalPdfDto {
    return {
      client: form.client.trim(),
      date: form.date.trim(),
      offerName: form.offerName.trim(),
      price: form.price.trim(),
      currency: form.currency.trim(),
      period: form.period.trim(),
      adBudget: form.adBudget.trim(),
    };
  }

  async function runGenerate(mode: "download" | "preview") {
    if (!leadId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const dto = dtoFromForm();
      const blob = await generateLeadProposalPdf(leadId, dto);
      if (mode === "preview") {
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          downloadBlob(blob, safeFilenameClient(dto.client || "Client"));
          onToast?.("Aperçu bloqué — PDF téléchargé.", "info");
        } else {
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          onToast?.("Aperçu ouvert.", "success");
        }
      } else {
        downloadBlob(blob, safeFilenameClient(dto.client || "Client"));
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
        aria-labelledby="lead-proposal-modal-title"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="lead-proposal-modal-title">
                Générer une proposition
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
                    <label className="form-label" htmlFor="lead-prop-client">
                      Client
                    </label>
                    <input
                      id="lead-prop-client"
                      className="form-control"
                      value={form.client}
                      disabled={busy}
                      onChange={(e) => patch("client", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="lead-prop-date">
                      Date
                    </label>
                    <input
                      id="lead-prop-date"
                      className="form-control"
                      value={form.date}
                      disabled={busy}
                      onChange={(e) => patch("date", e.target.value)}
                      placeholder="NOV 2026"
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="lead-prop-offer">
                      Offre
                    </label>
                    <input
                      id="lead-prop-offer"
                      className="form-control"
                      value={form.offerName}
                      disabled={busy}
                      onChange={(e) => patch("offerName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="lead-prop-price">
                      Prix
                    </label>
                    <input
                      id="lead-prop-price"
                      className="form-control"
                      value={form.price}
                      disabled={busy}
                      onChange={(e) => patch("price", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="lead-prop-currency">
                      Devise
                    </label>
                    <input
                      id="lead-prop-currency"
                      className="form-control"
                      value={form.currency}
                      disabled={busy}
                      onChange={(e) => patch("currency", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="lead-prop-period">
                      Période
                    </label>
                    <input
                      id="lead-prop-period"
                      className="form-control"
                      value={form.period}
                      disabled={busy}
                      onChange={(e) => patch("period", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="lead-prop-adbudget">
                      Budget pub
                    </label>
                    <textarea
                      id="lead-prop-adbudget"
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
                  disabled={busy || !leadId}
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
                <button type="submit" className="btn btn-primary" disabled={busy || !leadId}>
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
