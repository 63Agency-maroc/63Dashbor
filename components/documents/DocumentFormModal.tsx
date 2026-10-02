"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  computeLocalTotals,
  type Document,
  type DocumentKind,
  type UpsertDocumentDto,
  type UpsertDocumentLigneDto,
} from "@/lib/api/documents";
import type { Lead } from "@/lib/api/leads";
import { COMPANY_63, DEVIS_DEFAULT_LIGNES, DEVIS_DEFAULTS } from "@/lib/constants/company";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";
import { useLeadSuggestions } from "@/hooks/useLeadSuggestions";

type LigneForm = UpsertDocumentLigneDto;

export type DocumentFormValues = UpsertDocumentDto;

const LABELS: Record<
  DocumentKind,
  { createTitle: string; editTitle: (numero?: string) => string; createCta: string }
> = {
  devis: {
    createTitle: "Nouveau devis",
    editTitle: (n) => `Éditer ${n ?? "devis"}`,
    createCta: "Créer le devis",
  },
  facture: {
    createTitle: "Nouvelle facture",
    editTitle: (n) => `Éditer ${n ?? "facture"}`,
    createCta: "Créer la facture",
  },
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyLigne(): LigneForm {
  return { titre: "", description: "", quantite: 1, prixUnitaireHt: 0 };
}

function formatMentionTva(taux: number): string {
  const n = Number.isFinite(taux) ? taux : DEVIS_DEFAULTS.tvaTaux;
  const label = Number.isInteger(n) ? String(n) : String(n);
  return `TVA ${label} %`;
}

/** Mentions auto du type "TVA 20 %" — à resynchroniser avec le taux. */
function isAutoMentionTva(mention: string): boolean {
  return /^TVA\s*[\d.,]+\s*%\s*$/i.test(mention.trim());
}

function parseTvaTaux(raw: unknown, fallback: number = DEVIS_DEFAULTS.tvaTaux): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function defaultDevisLignes(): LigneForm[] {
  return DEVIS_DEFAULT_LIGNES.map((l) => ({
    titre: l.titre,
    description: l.description,
    quantite: l.quantite,
    prixUnitaireHt: l.prixUnitaireHt,
  }));
}

function emptyForm(kind: DocumentKind = "facture"): DocumentFormValues {
  return {
    ...COMPANY_63,
    clientNom: "",
    clientIce: "",
    clientEmail: "",
    clientTelephone: "",
    dateEmission: todayYmd(),
    lignes: kind === "devis" ? defaultDevisLignes() : [emptyLigne()],
    tvaTaux: DEVIS_DEFAULTS.tvaTaux,
    mentionTva: DEVIS_DEFAULTS.mentionTva,
    paiementMode: DEVIS_DEFAULTS.paiementMode,
    paiementBanque: DEVIS_DEFAULTS.paiementBanque,
    paiementTitulaire: DEVIS_DEFAULTS.paiementTitulaire,
    paiementRib: DEVIS_DEFAULTS.paiementRib,
  };
}

function fromDocument(d: Document): DocumentFormValues {
  const raw = d as Document & { tva_taux?: number | string };
  const tvaTaux = parseTvaTaux(raw.tvaTaux ?? raw.tva_taux);
  const mentionRaw = (d.mentionTva ?? "").trim();
  // Si mention absente ou auto ("TVA X %"), l’aligner sur le taux réel (évite "TVA 20 %" figé).
  const mentionTva =
    !mentionRaw || isAutoMentionTva(mentionRaw) ? formatMentionTva(tvaTaux) : mentionRaw;

  return {
    societeNom: d.societeNom ?? COMPANY_63.societeNom,
    societeRc: d.societeRc ?? COMPANY_63.societeRc,
    societeCnie: d.societeCnie ?? COMPANY_63.societeCnie,
    societeIce: d.societeIce ?? COMPANY_63.societeIce,
    societeTp: d.societeTp ?? COMPANY_63.societeTp,
    societeAdresse: d.societeAdresse ?? COMPANY_63.societeAdresse,
    societeTelephone: d.societeTelephone ?? COMPANY_63.societeTelephone,
    societeEmail: d.societeEmail ?? COMPANY_63.societeEmail,
    clientNom: d.clientNom ?? "",
    clientIce: d.clientIce ?? "",
    clientEmail: d.clientEmail ?? "",
    clientTelephone: d.clientTelephone ?? "",
    dateEmission: d.dateEmission || todayYmd(),
    lignes:
      d.lignes?.length > 0
        ? d.lignes.map((l) => ({
            titre: l.titre ?? "",
            description: l.description ?? "",
            quantite: Number.isFinite(Number(l.quantite)) ? Number(l.quantite) : 0,
            prixUnitaireHt: Number(l.prixUnitaireHt) || 0,
          }))
        : [emptyLigne()],
    tvaTaux,
    mentionTva,
    paiementMode: d.paiementMode ?? "",
    paiementBanque: d.paiementBanque ?? "",
    paiementTitulaire: d.paiementTitulaire ?? "",
    paiementRib: d.paiementRib ?? "",
  };
}

export function toUpsertDto(values: DocumentFormValues): UpsertDocumentDto {
  const dto: UpsertDocumentDto = {
    societeNom: values.societeNom.trim(),
    societeRc: values.societeRc.trim(),
    societeCnie: values.societeCnie.trim(),
    societeIce: values.societeIce.trim(),
    societeTp: values.societeTp.trim(),
    societeAdresse: values.societeAdresse.trim(),
    societeTelephone: values.societeTelephone.trim(),
    societeEmail: values.societeEmail.trim(),
    clientNom: values.clientNom.trim(),
    dateEmission: values.dateEmission,
    lignes: values.lignes.map((l) => ({
      titre: l.titre.trim(),
      description: l.description.trim(),
      quantite: Math.max(0, Number(l.quantite) || 0),
      prixUnitaireHt: Math.max(0, Number(l.prixUnitaireHt) || 0),
    })),
    tvaTaux: parseTvaTaux(values.tvaTaux, 0),
    mentionTva: values.mentionTva.trim(),
    paiementMode: values.paiementMode.trim(),
    paiementBanque: values.paiementBanque.trim(),
    paiementTitulaire: values.paiementTitulaire.trim(),
    paiementRib: values.paiementRib.trim(),
  };
  const ice = (values.clientIce ?? "").trim();
  const email = (values.clientEmail ?? "").trim();
  const tel = (values.clientTelephone ?? "").trim();
  if (ice) dto.clientIce = ice;
  if (email) dto.clientEmail = email;
  if (tel) dto.clientTelephone = tel;
  return dto;
}

type Props = {
  open: boolean;
  kind: DocumentKind;
  mode: "create" | "edit";
  initial?: Document | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (dto: UpsertDocumentDto) => void;
};

function money(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DocumentFormModal({
  open,
  kind,
  mode,
  initial,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const labels = LABELS[kind];
  const [form, setForm] = useState<DocumentFormValues>(() => emptyForm(kind));
  const [leadSuggestOpen, setLeadSuggestOpen] = useState(false);
  const wasOpenRef = useRef(false);
  const { items: leadSuggestions, busy: leadSearchBusy, clear: clearLeadSuggestions } =
    useLeadSuggestions(form.clientNom, open && leadSuggestOpen);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(mode === "edit" && initial ? fromDocument(initial) : emptyForm(kind));
      setLeadSuggestOpen(false);
      clearLeadSuggestions();
    }
    wasOpenRef.current = open;
  }, [open, mode, initial, kind, clearLeadSuggestions]);

  const totals = useMemo(
    () => computeLocalTotals(form.lignes, form.tvaTaux),
    [form.lignes, form.tvaTaux],
  );

  function setField<K extends keyof DocumentFormValues>(key: K, value: DocumentFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setTvaTaux(raw: number) {
    const tvaTaux = Number.isFinite(raw) ? raw : 0;
    setForm((prev) => ({
      ...prev,
      tvaTaux,
      // Resync la mention auto pour ne pas laisser "TVA 20 %" après un changement de taux
      mentionTva:
        !prev.mentionTva.trim() || isAutoMentionTva(prev.mentionTva)
          ? formatMentionTva(tvaTaux)
          : prev.mentionTva,
    }));
  }

  function updateLigne(idx: number, patch: Partial<LigneForm>) {
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }

  function addLigne() {
    setForm((prev) => ({ ...prev, lignes: [...prev.lignes, emptyLigne()] }));
  }

  function removeLigne(idx: number) {
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.length <= 1 ? prev.lignes : prev.lignes.filter((_, i) => i !== idx),
    }));
  }

  function pickLead(lead: Lead) {
    setForm((prev) => ({
      ...prev,
      clientNom: (lead.name || "").trim() || prev.clientNom,
      clientEmail: (lead.email || "").trim() || prev.clientEmail,
      clientTelephone: (lead.phone || "").trim() || prev.clientTelephone,
    }));
    setLeadSuggestOpen(false);
    clearLeadSuggestions();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(toUpsertDto(form));
  }

  if (!open) return null;

  const title = mode === "create" ? labels.createTitle : labels.editTitle(initial?.numero);
  const summary =
    mode === "create"
      ? kind === "devis"
        ? "Créer un devis 63 Agency"
        : "Créer une facture 63 Agency"
      : form.clientNom
        ? `Client · ${form.clientNom}`
        : kind === "devis"
          ? "Modifier le devis"
          : "Modifier la facture";

  return (
    <>
      <div
        className="modal fade show doc-form-overlay"
        style={{ display: "block" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-xl doc-form-dialog">
          <div className="modal-content doc-form-modal">
            <div className="doc-form__header">
              <div className="min-w-0">
                <h5 className="doc-form__title mb-1">{title}</h5>
                <p className="doc-form__summary mb-0">{summary}</p>
              </div>
              <button
                type="button"
                className="doc-form__close"
                aria-label="Fermer"
                onClick={onClose}
                disabled={submitting}
              >
                <i className="fi fi-rr-cross-small" aria-hidden />
              </button>
            </div>

            <form className="doc-form__form" onSubmit={handleSubmit}>
              <div className="doc-form__body">
                {error ? (
                  <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
                    <i className="fi fi-rr-exclamation mt-1" aria-hidden />
                    <div>
                      <div className="fw-semibold mb-0">Impossible d’enregistrer</div>
                      <div className="mb-0">{error}</div>
                    </div>
                  </div>
                ) : null}

                <section className="doc-form__card">
                  <div className="doc-form__card-label">Société</div>
                  <div className="row g-3">
                    {(
                      [
                        ["societeNom", "Nom"],
                        ["societeRc", "RC"],
                        ["societeCnie", "CNIE"],
                        ["societeIce", "ICE"],
                        ["societeTp", "TP"],
                        ["societeTelephone", "Téléphone"],
                        ["societeEmail", "Email"],
                      ] as const
                    ).map(([key, label]) => (
                      <div className="col-md-4" key={key}>
                        <label className="doc-form__label" htmlFor={`${kind}-${key}`}>
                          {label} <span className="text-danger">*</span>
                        </label>
                        <input
                          id={`${kind}-${key}`}
                          className="form-control"
                          value={form[key]}
                          onChange={(e) => setField(key, e.target.value)}
                          required
                          disabled={submitting}
                        />
                      </div>
                    ))}
                    <div className="col-12">
                      <label className="doc-form__label" htmlFor={`${kind}-societeAdresse`}>
                        Adresse <span className="text-danger">*</span>
                      </label>
                      <textarea
                        id={`${kind}-societeAdresse`}
                        className="form-control"
                        rows={2}
                        value={form.societeAdresse}
                        onChange={(e) => setField("societeAdresse", e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </section>

                <section className="doc-form__card">
                  <div className="doc-form__card-label">Client</div>
                  <div className="row g-3">
                    <div className="col-md-6 position-relative">
                      <label className="doc-form__label" htmlFor={`${kind}-clientNom`}>
                        Nom client <span className="text-danger">*</span>
                      </label>
                      <input
                        id={`${kind}-clientNom`}
                        className="form-control"
                        value={form.clientNom}
                        onChange={(e) => {
                          setLeadSuggestOpen(true);
                          setField("clientNom", e.target.value);
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
                      {leadSearchBusy ? <div className="doc-form__hint">Recherche leads…</div> : null}
                      {leadSuggestOpen && leadSuggestions.length > 0 ? (
                        <ul className="doc-form__suggest list-group shadow-sm">
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
                    <div className="col-md-6">
                      <label className="doc-form__label" htmlFor={`${kind}-clientIce`}>
                        ICE
                      </label>
                      <input
                        id={`${kind}-clientIce`}
                        className="form-control"
                        value={form.clientIce ?? ""}
                        onChange={(e) => setField("clientIce", e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="doc-form__label" htmlFor={`${kind}-clientEmail`}>
                        Email
                      </label>
                      <input
                        id={`${kind}-clientEmail`}
                        type="email"
                        className="form-control"
                        value={form.clientEmail ?? ""}
                        onChange={(e) => setField("clientEmail", e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="doc-form__label" htmlFor={`${kind}-clientTelephone`}>
                        Téléphone
                      </label>
                      <input
                        id={`${kind}-clientTelephone`}
                        className="form-control"
                        value={form.clientTelephone ?? ""}
                        onChange={(e) => setField("clientTelephone", e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="doc-form__label" htmlFor={`${kind}-dateEmission`}>
                        Date d&apos;émission <span className="text-danger">*</span>
                      </label>
                      <div className="doc-form__field-icon">
                        <CasablancaDatePicker
                          id={`${kind}-dateEmission`}
                          value={form.dateEmission}
                          onChange={(ymd) => setField("dateEmission", ymd)}
                          disabled={submitting}
                        />
                        <i className="fi fi-rr-calendar doc-form__icon" aria-hidden />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="doc-form__card">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                    <div className="doc-form__card-label mb-0">Lignes</div>
                    <button
                      type="button"
                      className="doc-form__add-btn"
                      onClick={addLigne}
                      disabled={submitting}
                    >
                      <i className="fi fi-rr-plus" aria-hidden /> Ajouter une ligne
                    </button>
                  </div>
                  <div className="doc-form__table-wrap">
                    <table className="table table-sm align-middle mb-0 doc-form__table">
                      <thead>
                        <tr>
                          <th>Titre</th>
                          <th>Description</th>
                          <th style={{ width: 90 }}>Qté</th>
                          <th style={{ width: 120 }}>PU HT</th>
                          <th style={{ width: 110 }}>Total HT</th>
                          <th style={{ width: 48 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {form.lignes.map((l, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                value={l.titre}
                                onChange={(e) => updateLigne(idx, { titre: e.target.value })}
                                required
                                disabled={submitting}
                                placeholder="Titre"
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                value={l.description}
                                onChange={(e) => updateLigne(idx, { description: e.target.value })}
                                required
                                disabled={submitting}
                                placeholder="Description"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                min={0}
                                step={1}
                                value={l.quantite}
                                onChange={(e) => updateLigne(idx, { quantite: Number(e.target.value) })}
                                required
                                disabled={submitting}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                min={0}
                                step={0.01}
                                value={l.prixUnitaireHt}
                                onChange={(e) =>
                                  updateLigne(idx, { prixUnitaireHt: Number(e.target.value) })
                                }
                                required
                                disabled={submitting}
                              />
                            </td>
                            <td className="small text-end font-monospace">
                              {money(totals.lignesHt[idx] ?? 0)}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-subtle-danger btn-icon"
                                title="Supprimer"
                                onClick={() => removeLigne(idx)}
                                disabled={submitting || form.lignes.length <= 1}
                              >
                                <i className="fi fi-rr-trash" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="row g-3 mt-2">
                    <div className="col-md-3">
                      <label className="doc-form__label" htmlFor={`${kind}-tvaTaux`}>
                        TVA % <span className="text-danger">*</span>
                      </label>
                      <input
                        id={`${kind}-tvaTaux`}
                        type="number"
                        className="form-control"
                        min={0}
                        max={100}
                        step={0.01}
                        value={form.tvaTaux}
                        onChange={(e) => setTvaTaux(Number(e.target.value))}
                        required
                        disabled={submitting}
                      />
                    </div>
                    <div className="col-md-9">
                      <label className="doc-form__label" htmlFor={`${kind}-mentionTva`}>
                        Mention annuel
                      </label>
                      <input
                        id={`${kind}-mentionTva`}
                        className="form-control"
                        value={form.mentionTva}
                        onChange={(e) => setField("mentionTva", e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </section>

                <section className="doc-form__card">
                  <div className="doc-form__card-label">Paiement</div>
                  <div className="row g-3">
                    {(
                      [
                        ["paiementMode", "Mode"],
                        ["paiementBanque", "Banque"],
                        ["paiementTitulaire", "Titulaire"],
                        ["paiementRib", "RIB"],
                      ] as const
                    ).map(([key, label]) => (
                      <div className="col-md-6" key={key}>
                        <label className="doc-form__label" htmlFor={`${kind}-${key}`}>
                          {label} <span className="text-danger">*</span>
                        </label>
                        <input
                          id={`${kind}-${key}`}
                          className="form-control"
                          value={form[key]}
                          onChange={(e) => setField(key, e.target.value)}
                          required
                          disabled={submitting}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="doc-form__totals">
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Total HT</span>
                    <strong className="font-monospace">{money(totals.totalHt)} MAD</strong>
                  </div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>TVA</span>
                    <strong className="font-monospace">{money(totals.montantTva)} MAD</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="fw-semibold">Total TTC</span>
                    <strong className="font-monospace">{money(totals.totalTtc)} MAD</strong>
                  </div>
                  <div className="doc-form__hint mb-0 mt-2">
                    Aperçu local — le backend recalcule à l&apos;enregistrement.
                  </div>
                </section>
              </div>

              <div className="doc-form__footer">
                <button
                  type="button"
                  className="doc-form__btn doc-form__btn--ghost"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="doc-form__btn doc-form__btn--primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Enregistrement…
                    </>
                  ) : mode === "create" ? (
                    labels.createCta
                  ) : (
                    "Enregistrer"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
