"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getClients, type Client } from "@/lib/api/clients";
import {
  computeLocalTotals,
  type Document,
  type DocumentKind,
  type UpsertDocumentDto,
  type UpsertDocumentLigneDto,
} from "@/lib/api/documents";
import { COMPANY_63, DEVIS_DEFAULTS } from "@/lib/constants/company";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";

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

function emptyForm(): DocumentFormValues {
  return {
    ...COMPANY_63,
    clientNom: "",
    clientIce: "",
    clientEmail: "",
    clientTelephone: "",
    dateEmission: todayYmd(),
    lignes: [emptyLigne()],
    tvaTaux: DEVIS_DEFAULTS.tvaTaux,
    mentionTva: DEVIS_DEFAULTS.mentionTva,
    paiementMode: DEVIS_DEFAULTS.paiementMode,
    paiementBanque: DEVIS_DEFAULTS.paiementBanque,
    paiementTitulaire: DEVIS_DEFAULTS.paiementTitulaire,
    paiementRib: DEVIS_DEFAULTS.paiementRib,
  };
}

function fromDocument(d: Document): DocumentFormValues {
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
            quantite: Number(l.quantite) || 1,
            prixUnitaireHt: Number(l.prixUnitaireHt) || 0,
          }))
        : [emptyLigne()],
    tvaTaux: Number(d.tvaTaux) || DEVIS_DEFAULTS.tvaTaux,
    mentionTva: d.mentionTva || DEVIS_DEFAULTS.mentionTva,
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
      quantite: Math.max(1, Number(l.quantite) || 1),
      prixUnitaireHt: Math.max(0, Number(l.prixUnitaireHt) || 0),
    })),
    tvaTaux: Number(values.tvaTaux) || 0,
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
  const [form, setForm] = useState<DocumentFormValues>(emptyForm);
  const [clientQuery, setClientQuery] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [clientSearchBusy, setClientSearchBusy] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(mode === "edit" && initial ? fromDocument(initial) : emptyForm());
      setClientQuery("");
      setClientSuggestions([]);
    }
    wasOpenRef.current = open;
  }, [open, mode, initial]);

  useEffect(() => {
    if (!open) return;
    const q = clientQuery.trim();
    if (q.length < 2) {
      setClientSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setClientSearchBusy(true);
      void getClients()
        .then((items) => {
          if (cancelled) return;
          const lower = q.toLowerCase();
          setClientSuggestions(
            items
              .filter((c) =>
                [c.clientNom, c.clientEmail, c.clientTelephone, c.clientIce]
                  .join(" ")
                  .toLowerCase()
                  .includes(lower),
              )
              .slice(0, 8),
          );
        })
        .catch(() => {
          if (!cancelled) setClientSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setClientSearchBusy(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [clientQuery, open]);

  const totals = useMemo(
    () => computeLocalTotals(form.lignes, form.tvaTaux),
    [form.lignes, form.tvaTaux],
  );

  function setField<K extends keyof DocumentFormValues>(key: K, value: DocumentFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  function normalizeClient(raw: Client | Record<string, unknown>): {
    clientNom: string;
    clientIce: string;
    clientEmail: string;
    clientTelephone: string;
  } {
    const r = raw as Record<string, unknown>;
    const str = (v: unknown) => (v == null ? "" : String(v).trim());
    return {
      clientNom: str(r.clientNom ?? r.client_nom ?? r.nom),
      clientIce: str(r.clientIce ?? r.client_ice ?? r.ice),
      clientEmail: str(r.clientEmail ?? r.client_email ?? r.email),
      clientTelephone: str(r.clientTelephone ?? r.client_telephone ?? r.telephone),
    };
  }

  function pickClient(raw: Client) {
    const c = normalizeClient(raw);
    setForm((prev) => ({
      ...prev,
      clientNom: c.clientNom,
      clientIce: c.clientIce,
      clientEmail: c.clientEmail,
      clientTelephone: c.clientTelephone,
    }));
    setClientQuery("");
    setClientSuggestions([]);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(toUpsertDto(form));
  }

  if (!open) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div
          className="modal-dialog modal-xl modal-dialog-centered"
          style={{ maxHeight: "90vh", margin: "1.75rem auto" }}
        >
          <div
            className="modal-content"
            style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="modal-header flex-shrink-0">
              <h5 className="modal-title">
                {mode === "create" ? labels.createTitle : labels.editTitle(initial?.numero)}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={submitting} />
            </div>
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}
            >
              <div
                className="modal-body"
                style={{ overflowY: "auto", flex: "1 1 auto", maxHeight: "calc(85vh - 8rem)" }}
              >
                {error ? (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                ) : null}

                <h6 className="mb-3">Société</h6>
                <div className="row g-2 mb-4">
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
                      <label className="form-label" htmlFor={`${kind}-${key}`}>
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
                    <label className="form-label" htmlFor={`${kind}-societeAdresse`}>
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

                <h6 className="mb-3">Client</h6>
                <div className="mb-2 position-relative">
                  <label className="form-label" htmlFor={`${kind}-client-search`}>
                    Rechercher un client existant
                  </label>
                  <input
                    id={`${kind}-client-search`}
                    type="search"
                    className="form-control"
                    placeholder="Nom, email, téléphone…"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    disabled={submitting}
                    autoComplete="off"
                  />
                  {clientSearchBusy && <div className="form-text">Recherche…</div>}
                  {clientSuggestions.length > 0 && (
                    <ul
                      className="list-group position-absolute w-100 shadow-sm"
                      style={{ zIndex: 20, maxHeight: 220, overflowY: "auto" }}
                    >
                      {clientSuggestions.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="list-group-item list-group-item-action"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickClient(c);
                            }}
                          >
                            <span className="fw-medium">{c.clientNom}</span>
                            <span className="small text-muted d-block">
                              {[c.clientEmail, c.clientTelephone].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="row g-2 mb-4">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor={`${kind}-clientNom`}>
                      Nom client <span className="text-danger">*</span>
                    </label>
                    <input
                      id={`${kind}-clientNom`}
                      className="form-control"
                      value={form.clientNom}
                      onChange={(e) => setField("clientNom", e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor={`${kind}-clientIce`}>
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
                    <label className="form-label" htmlFor={`${kind}-clientEmail`}>
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
                    <label className="form-label" htmlFor={`${kind}-clientTelephone`}>
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
                    <label className="form-label" htmlFor={`${kind}-dateEmission`}>
                      Date d&apos;émission <span className="text-danger">*</span>
                    </label>
                    <CasablancaDatePicker
                      id={`${kind}-dateEmission`}
                      value={form.dateEmission}
                      onChange={(ymd) => setField("dateEmission", ymd)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="mb-0">Lignes</h6>
                  <button
                    type="button"
                    className="btn btn-sm btn-subtle-primary"
                    onClick={addLigne}
                    disabled={submitting}
                  >
                    <i className="fi fi-rr-plus me-1" /> Ajouter une ligne
                  </button>
                </div>
                <div className="table-responsive mb-3 border rounded">
                  <table className="table table-sm align-middle mb-0">
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
                              min={1}
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

                <div className="row g-2 mb-3">
                  <div className="col-md-3">
                    <label className="form-label" htmlFor={`${kind}-tvaTaux`}>
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
                      onChange={(e) => setField("tvaTaux", Number(e.target.value))}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-md-9">
                    <label className="form-label" htmlFor={`${kind}-mentionTva`}>
                      Mention TVA <span className="text-danger">*</span>
                    </label>
                    <input
                      id={`${kind}-mentionTva`}
                      className="form-control"
                      value={form.mentionTva}
                      onChange={(e) => setField("mentionTva", e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <h6 className="mb-3">Paiement</h6>
                <div className="row g-2 mb-4">
                  {(
                    [
                      ["paiementMode", "Mode"],
                      ["paiementBanque", "Banque"],
                      ["paiementTitulaire", "Titulaire"],
                      ["paiementRib", "RIB"],
                    ] as const
                  ).map(([key, label]) => (
                    <div className="col-md-6" key={key}>
                      <label className="form-label" htmlFor={`${kind}-${key}`}>
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

                <div className="border rounded p-3 bg-light">
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Total HT</span>
                    <strong className="font-monospace">{money(totals.totalHt)} MAD</strong>
                  </div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>TVA</span>
                    <strong className="font-monospace">{money(totals.montantTva)} MAD</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="fw-medium">Total TTC</span>
                    <strong className="font-monospace">{money(totals.totalTtc)} MAD</strong>
                  </div>
                  <div className="form-text mb-0">Aperçu local — le backend recalcule à l&apos;enregistrement.</div>
                </div>
              </div>
              <div className="modal-footer flex-shrink-0 border-top bg-body">
                <button type="button" className="btn btn-light" onClick={onClose} disabled={submitting}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
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
