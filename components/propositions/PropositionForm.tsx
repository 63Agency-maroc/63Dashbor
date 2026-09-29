"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  type UpsertPropositionDto,
} from "@/lib/api/propositions";
import type { Lead } from "@/lib/api/leads";
import { CasablancaDatePicker } from "@/components/calendar/CasablancaDatePicker";
import { useLeadSuggestions } from "@/hooks/useLeadSuggestions";

type SectionKey =
  | "general"
  | "emetteur"
  | "introduction"
  | "strategie"
  | "tarifs"
  | "pourquoi"
  | "contact";

type Props = {
  initial: UpsertPropositionDto;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (dto: UpsertPropositionDto) => void;
  onCancel: () => void;
};

function StringListEditor({
  label,
  values,
  disabled,
  onChange,
  placeholder = "Élément…",
}: {
  label: string;
  values: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="mb-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <label className="form-label mb-0">{label}</label>
        <button
          type="button"
          className="btn btn-sm btn-subtle-primary"
          disabled={disabled}
          onClick={() => onChange([...values, ""])}
        >
          <i className="fi fi-rr-plus me-1" /> Ajouter
        </button>
      </div>
      {values.map((v, i) => (
        <div className="input-group mb-2" key={i}>
          <input
            className="form-control"
            value={v}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="btn btn-outline-danger"
            disabled={disabled || values.length <= 1}
            title="Supprimer"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            <i className="fi fi-rr-trash" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function PropositionForm({
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<UpsertPropositionDto>(initial);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    general: true,
    emetteur: false,
    introduction: false,
    strategie: true,
    tarifs: false,
    pourquoi: false,
    contact: false,
  });

  const [leadSuggestOpen, setLeadSuggestOpen] = useState(false);
  const { items: leadSuggestions, busy: leadSearchBusy, clear: clearLeadSuggestions } =
    useLeadSuggestions(form.clientNom, open.general && leadSuggestOpen);

  useEffect(() => {
    setForm(initial);
    setLeadSuggestOpen(false);
    clearLeadSuggestions();
  }, [initial, clearLeadSuggestions]);

  function toggle(key: SectionKey) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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

  const s1 = form.strategie.section1CreationContenu;
  const s2 = form.strategie.section2CampagnesPublicitaires;
  const s3 = form.strategie.section3FunnelMarketing;
  const s4 = form.strategie.section4Automatisation;

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

      {/* —— Infos générales —— */}
      <div className="doc-form__section-card card mb-3">
        <button
          type="button"
          className="doc-form__section-toggle card-header d-flex align-items-center justify-content-between btn btn-link text-decoration-none text-body text-start w-100"
          onClick={() => toggle("general")}
        >
          <span className="doc-form__section-title">Infos générales</span>
          <i className={`fi ${open.general ? "fi-rr-angle-small-up" : "fi-rr-angle-small-down"}`} />
        </button>
        {open.general && (
          <div className="card-body">
            <div className="row g-2 mb-3">
              <div className="col-md-8">
                <label className="form-label" htmlFor="titreProposition">
                  Titre proposition <span className="text-danger">*</span>
                </label>
                <input
                  id="titreProposition"
                  className="form-control"
                  value={form.titreProposition}
                  onChange={(e) => setForm((p) => ({ ...p, titreProposition: e.target.value }))}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="dateEmission">
                  Date d&apos;émission <span className="text-danger">*</span>
                </label>
                <CasablancaDatePicker
                  id="dateEmission"
                  value={form.dateEmission}
                  onChange={(ymd) => setForm((p) => ({ ...p, dateEmission: ymd }))}
                  disabled={submitting}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="preparePour">
                  Préparé pour <span className="text-danger">*</span>
                </label>
                <input
                  id="preparePour"
                  className="form-control"
                  value={form.preparePour}
                  onChange={(e) => setForm((p) => ({ ...p, preparePour: e.target.value }))}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="preparePar">
                  Préparé par
                </label>
                <input
                  id="preparePar"
                  className="form-control"
                  value={form.preparePar}
                  onChange={(e) => setForm((p) => ({ ...p, preparePar: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="clientNom">
                  Nom client <span className="text-danger">*</span>
                </label>
                <div className="position-relative">
                  <input
                    id="clientNom"
                    className="form-control"
                    value={form.clientNom}
                    onChange={(e) => {
                      setLeadSuggestOpen(true);
                      setForm((p) => ({ ...p, clientNom: e.target.value }));
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
              <div className="col-md-6">
                <label className="form-label" htmlFor="nomEtablissement">
                  Nom établissement
                </label>
                <input
                  id="nomEtablissement"
                  className="form-control"
                  value={form.nomEtablissement}
                  onChange={(e) => setForm((p) => ({ ...p, nomEtablissement: e.target.value }))}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label" htmlFor="clientIce">
                  ICE
                </label>
                <input
                  id="clientIce"
                  className="form-control"
                  value={form.clientIce ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, clientIce: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="clientEmail">
                  Email
                </label>
                <input
                  id="clientEmail"
                  type="email"
                  className="form-control"
                  value={form.clientEmail ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, clientEmail: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="clientTelephone">
                  Téléphone
                </label>
                <input
                  id="clientTelephone"
                  className="form-control"
                  value={form.clientTelephone ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, clientTelephone: e.target.value }))}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* —— Émetteur —— */}
      <div className="doc-form__section-card card mb-3">
        <button
          type="button"
          className="doc-form__section-toggle card-header d-flex align-items-center justify-content-between btn btn-link text-decoration-none text-body text-start w-100"
          onClick={() => toggle("emetteur")}
        >
          <span className="doc-form__section-title">Émetteur (63 Agency)</span>
          <i className={`fi ${open.emetteur ? "fi-rr-angle-small-up" : "fi-rr-angle-small-down"}`} />
        </button>
        {open.emetteur && (
          <div className="card-body">
            <div className="row g-2">
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
                  <label className="form-label" htmlFor={`em-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`em-${key}`}
                    className="form-control"
                    value={form.emetteur[key]}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        emetteur: { ...p.emetteur, [key]: e.target.value },
                      }))
                    }
                    disabled={submitting}
                  />
                </div>
              ))}
              <div className="col-12">
                <label className="form-label" htmlFor="em-societeAdresse">
                  Adresse
                </label>
                <textarea
                  id="em-societeAdresse"
                  className="form-control"
                  rows={2}
                  value={form.emetteur.societeAdresse}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      emetteur: { ...p.emetteur, societeAdresse: e.target.value },
                    }))
                  }
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* —— Introduction —— */}
      <div className="doc-form__section-card card mb-3">
        <button
          type="button"
          className="doc-form__section-toggle card-header d-flex align-items-center justify-content-between btn btn-link text-decoration-none text-body text-start w-100"
          onClick={() => toggle("introduction")}
        >
          <span className="doc-form__section-title">Introduction</span>
          <i className={`fi ${open.introduction ? "fi-rr-angle-small-up" : "fi-rr-angle-small-down"}`} />
        </button>
        {open.introduction && (
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label" htmlFor="paragraphe1">
                Paragraphe 1
              </label>
              <textarea
                id="paragraphe1"
                className="form-control"
                rows={3}
                value={form.introduction.paragraphe1}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    introduction: { ...p.introduction, paragraphe1: e.target.value },
                  }))
                }
                disabled={submitting}
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="paragraphe2">
                Paragraphe 2
              </label>
              <textarea
                id="paragraphe2"
                className="form-control"
                rows={3}
                value={form.introduction.paragraphe2}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    introduction: { ...p.introduction, paragraphe2: e.target.value },
                  }))
                }
                disabled={submitting}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="objectifProspects">
                Objectif prospects
              </label>
              <input
                id="objectifProspects"
                type="number"
                min={0}
                className="form-control"
                value={form.introduction.objectifProspects}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    introduction: {
                      ...p.introduction,
                      objectifProspects: Number(e.target.value),
                    },
                  }))
                }
                disabled={submitting}
              />
            </div>
          </div>
        )}
      </div>

      {/* —— Stratégie —— */}
      <div className="doc-form__section-card card mb-3">
        <button
          type="button"
          className="doc-form__section-toggle card-header d-flex align-items-center justify-content-between btn btn-link text-decoration-none text-body text-start w-100"
          onClick={() => toggle("strategie")}
        >
          <span className="doc-form__section-title">Stratégie</span>
          <i className={`fi ${open.strategie ? "fi-rr-angle-small-up" : "fi-rr-angle-small-down"}`} />
        </button>
        {open.strategie && (
          <div className="card-body">
            <h6 className="mb-3">1. Création de contenu</h6>
            <div className="mb-3">
              <label className="form-label" htmlFor="s1-desc">
                Description
              </label>
              <textarea
                id="s1-desc"
                className="form-control"
                rows={2}
                value={s1.description}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    strategie: {
                      ...p.strategie,
                      section1CreationContenu: {
                        ...p.strategie.section1CreationContenu,
                        description: e.target.value,
                      },
                    },
                  }))
                }
                disabled={submitting}
              />
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-3">
                <label className="form-label" htmlFor="videosMin">
                  Vidéos min
                </label>
                <input
                  id="videosMin"
                  type="number"
                  min={0}
                  className="form-control"
                  value={s1.videosMin}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      strategie: {
                        ...p.strategie,
                        section1CreationContenu: {
                          ...p.strategie.section1CreationContenu,
                          videosMin: Number(e.target.value),
                        },
                      },
                    }))
                  }
                  disabled={submitting}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="videosMax">
                  Vidéos max
                </label>
                <input
                  id="videosMax"
                  type="number"
                  min={0}
                  className="form-control"
                  value={s1.videosMax}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      strategie: {
                        ...p.strategie,
                        section1CreationContenu: {
                          ...p.strategie.section1CreationContenu,
                          videosMax: Number(e.target.value),
                        },
                      },
                    }))
                  }
                  disabled={submitting}
                />
              </div>
            </div>
            <StringListEditor
              label="Topics"
              values={s1.topics}
              disabled={submitting}
              placeholder="Topic…"
              onChange={(topics) =>
                setForm((p) => ({
                  ...p,
                  strategie: {
                    ...p.strategie,
                    section1CreationContenu: {
                      ...p.strategie.section1CreationContenu,
                      topics,
                    },
                  },
                }))
              }
            />

            <hr className="my-4" />
            <h6 className="mb-3">2. Campagnes publicitaires</h6>
            <div className="mb-3">
              <label className="form-label" htmlFor="s2-intro">
                Intro
              </label>
              <textarea
                id="s2-intro"
                className="form-control"
                rows={2}
                value={s2.intro}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    strategie: {
                      ...p.strategie,
                      section2CampagnesPublicitaires: {
                        ...p.strategie.section2CampagnesPublicitaires,
                        intro: e.target.value,
                      },
                    },
                  }))
                }
                disabled={submitting}
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="s2-approche">
                Approche intro
              </label>
              <textarea
                id="s2-approche"
                className="form-control"
                rows={2}
                value={s2.approcheIntro}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    strategie: {
                      ...p.strategie,
                      section2CampagnesPublicitaires: {
                        ...p.strategie.section2CampagnesPublicitaires,
                        approcheIntro: e.target.value,
                      },
                    },
                  }))
                }
                disabled={submitting}
              />
            </div>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-medium">Blocs</span>
              <button
                type="button"
                className="btn btn-sm btn-subtle-primary"
                disabled={submitting}
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    strategie: {
                      ...p.strategie,
                      section2CampagnesPublicitaires: {
                        ...p.strategie.section2CampagnesPublicitaires,
                        blocs: [
                          ...p.strategie.section2CampagnesPublicitaires.blocs,
                          { titre: "", intro: "", points: [""] },
                        ],
                      },
                    },
                  }))
                }
              >
                <i className="fi fi-rr-plus me-1" /> Ajouter un bloc
              </button>
            </div>
            {s2.blocs.map((bloc, bi) => (
              <div className="border rounded p-3 mb-3" key={bi}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-muted">Bloc {bi + 1}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-subtle-danger"
                    disabled={submitting || s2.blocs.length <= 1}
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        strategie: {
                          ...p.strategie,
                          section2CampagnesPublicitaires: {
                            ...p.strategie.section2CampagnesPublicitaires,
                            blocs: p.strategie.section2CampagnesPublicitaires.blocs.filter(
                              (_, j) => j !== bi,
                            ),
                          },
                        },
                      }))
                    }
                  >
                    <i className="fi fi-rr-trash" />
                  </button>
                </div>
                <div className="mb-2">
                  <label className="form-label">Titre</label>
                  <input
                    className="form-control"
                    value={bloc.titre}
                    disabled={submitting}
                    onChange={(e) =>
                      setForm((p) => {
                        const blocs = [...p.strategie.section2CampagnesPublicitaires.blocs];
                        blocs[bi] = { ...blocs[bi], titre: e.target.value };
                        return {
                          ...p,
                          strategie: {
                            ...p.strategie,
                            section2CampagnesPublicitaires: {
                              ...p.strategie.section2CampagnesPublicitaires,
                              blocs,
                            },
                          },
                        };
                      })
                    }
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Intro</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={bloc.intro}
                    disabled={submitting}
                    onChange={(e) =>
                      setForm((p) => {
                        const blocs = [...p.strategie.section2CampagnesPublicitaires.blocs];
                        blocs[bi] = { ...blocs[bi], intro: e.target.value };
                        return {
                          ...p,
                          strategie: {
                            ...p.strategie,
                            section2CampagnesPublicitaires: {
                              ...p.strategie.section2CampagnesPublicitaires,
                              blocs,
                            },
                          },
                        };
                      })
                    }
                  />
                </div>
                <StringListEditor
                  label="Points"
                  values={bloc.points}
                  disabled={submitting}
                  placeholder="Point…"
                  onChange={(points) =>
                    setForm((p) => {
                      const blocs = [...p.strategie.section2CampagnesPublicitaires.blocs];
                      blocs[bi] = { ...blocs[bi], points };
                      return {
                        ...p,
                        strategie: {
                          ...p.strategie,
                          section2CampagnesPublicitaires: {
                            ...p.strategie.section2CampagnesPublicitaires,
                            blocs,
                          },
                        },
                      };
                    })
                  }
                />
              </div>
            ))}

            <div className="mb-0">
              <label className="form-label" htmlFor="s2-conclusion">
                Conclusion
              </label>
              <textarea
                id="s2-conclusion"
                className="form-control"
                rows={2}
                value={s2.conclusion}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    strategie: {
                      ...p.strategie,
                      section2CampagnesPublicitaires: {
                        ...p.strategie.section2CampagnesPublicitaires,
                        conclusion: e.target.value,
                      },
                    },
                  }))
                }
                disabled={submitting}
              />
            </div>

            <hr className="my-4" />
            <h6 className="mb-3">3. Funnel marketing</h6>
            <div className="mb-3">
              <label className="form-label" htmlFor="s3-intro">
                Intro
              </label>
              <textarea
                id="s3-intro"
                className="form-control"
                rows={2}
                value={s3.intro}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    strategie: {
                      ...p.strategie,
                      section3FunnelMarketing: {
                        ...p.strategie.section3FunnelMarketing,
                        intro: e.target.value,
                      },
                    },
                  }))
                }
                disabled={submitting}
              />
            </div>
            <StringListEditor
              label="Critères"
              values={s3.criteres}
              disabled={submitting}
              placeholder="Critère…"
              onChange={(criteres) =>
                setForm((p) => ({
                  ...p,
                  strategie: {
                    ...p.strategie,
                    section3FunnelMarketing: {
                      ...p.strategie.section3FunnelMarketing,
                      criteres,
                    },
                  },
                }))
              }
            />
            <div className="mb-0">
              <label className="form-label" htmlFor="s3-conclusion">
                Conclusion
              </label>
              <textarea
                id="s3-conclusion"
                className="form-control"
                rows={2}
                value={s3.conclusion}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    strategie: {
                      ...p.strategie,
                      section3FunnelMarketing: {
                        ...p.strategie.section3FunnelMarketing,
                        conclusion: e.target.value,
                      },
                    },
                  }))
                }
                disabled={submitting}
              />
            </div>

            <hr className="my-4" />
            <h6 className="mb-3">4. Automatisation</h6>
            <StringListEditor
              label="Points"
              values={s4.points}
              disabled={submitting}
              placeholder="Point…"
              onChange={(points) =>
                setForm((p) => ({
                  ...p,
                  strategie: {
                    ...p.strategie,
                    section4Automatisation: {
                      ...p.strategie.section4Automatisation,
                      points,
                    },
                  },
                }))
              }
            />
            <div className="mb-0">
              <label className="form-label" htmlFor="s4-objectif">
                Objectif
              </label>
              <textarea
                id="s4-objectif"
                className="form-control"
                rows={2}
                value={s4.objectif}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    strategie: {
                      ...p.strategie,
                      section4Automatisation: {
                        ...p.strategie.section4Automatisation,
                        objectif: e.target.value,
                      },
                    },
                  }))
                }
                disabled={submitting}
              />
            </div>
          </div>
        )}
      </div>

      {/* —— Tarifs —— */}
      <div className="doc-form__section-card card mb-3">
        <button
          type="button"
          className="doc-form__section-toggle card-header d-flex align-items-center justify-content-between btn btn-link text-decoration-none text-body text-start w-100"
          onClick={() => toggle("tarifs")}
        >
          <span className="doc-form__section-title">Tarifs (textes d&apos;affichage)</span>
          <i className={`fi ${open.tarifs ? "fi-rr-angle-small-up" : "fi-rr-angle-small-down"}`} />
        </button>
        {open.tarifs && (
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-medium">Lignes</span>
              <button
                type="button"
                className="btn btn-sm btn-subtle-primary"
                disabled={submitting}
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    tarifs: {
                      ...p.tarifs,
                      lignes: [
                        ...p.tarifs.lignes,
                        { service: "", detail: "", prixInitial: "", prixOffert: "" },
                      ],
                    },
                  }))
                }
              >
                <i className="fi fi-rr-plus me-1" /> Ajouter une ligne
              </button>
            </div>
            <div className="table-responsive mb-3 border rounded">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Détail</th>
                    <th style={{ width: 140 }}>Prix initial</th>
                    <th style={{ width: 140 }}>Prix offert</th>
                    <th style={{ width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  {form.tarifs.lignes.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={l.service}
                          disabled={submitting}
                          placeholder="Service"
                          onChange={(e) =>
                            setForm((p) => {
                              const lignes = [...p.tarifs.lignes];
                              lignes[i] = { ...lignes[i], service: e.target.value };
                              return { ...p, tarifs: { ...p.tarifs, lignes } };
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={l.detail}
                          disabled={submitting}
                          placeholder="Détail"
                          onChange={(e) =>
                            setForm((p) => {
                              const lignes = [...p.tarifs.lignes];
                              lignes[i] = { ...lignes[i], detail: e.target.value };
                              return { ...p, tarifs: { ...p.tarifs, lignes } };
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={l.prixInitial}
                          disabled={submitting}
                          placeholder="ex. 8000 MAD"
                          onChange={(e) =>
                            setForm((p) => {
                              const lignes = [...p.tarifs.lignes];
                              lignes[i] = { ...lignes[i], prixInitial: e.target.value };
                              return { ...p, tarifs: { ...p.tarifs, lignes } };
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={l.prixOffert}
                          disabled={submitting}
                          placeholder="ex. 6000 MAD"
                          onChange={(e) =>
                            setForm((p) => {
                              const lignes = [...p.tarifs.lignes];
                              lignes[i] = { ...lignes[i], prixOffert: e.target.value };
                              return { ...p, tarifs: { ...p.tarifs, lignes } };
                            })
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-subtle-danger btn-icon"
                          disabled={submitting || form.tarifs.lignes.length <= 1}
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              tarifs: {
                                ...p.tarifs,
                                lignes: p.tarifs.lignes.filter((_, j) => j !== i),
                              },
                            }))
                          }
                        >
                          <i className="fi fi-rr-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mb-0">
              <label className="form-label" htmlFor="noteMetaAds">
                Note Meta Ads
              </label>
              <textarea
                id="noteMetaAds"
                className="form-control"
                rows={2}
                value={form.tarifs.noteMetaAds}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    tarifs: { ...p.tarifs, noteMetaAds: e.target.value },
                  }))
                }
                disabled={submitting}
              />
            </div>
          </div>
        )}
      </div>

      {/* —— Pourquoi choisir / prochaines étapes —— */}
      <div className="doc-form__section-card card mb-3">
        <button
          type="button"
          className="doc-form__section-toggle card-header d-flex align-items-center justify-content-between btn btn-link text-decoration-none text-body text-start w-100"
          onClick={() => toggle("pourquoi")}
        >
          <span className="doc-form__section-title">Pourquoi nous / Prochaines étapes</span>
          <i className={`fi ${open.pourquoi ? "fi-rr-angle-small-up" : "fi-rr-angle-small-down"}`} />
        </button>
        {open.pourquoi && (
          <div className="card-body">
            <StringListEditor
              label="Pourquoi choisir"
              values={form.pourquoiChoisir}
              disabled={submitting}
              placeholder="Argument…"
              onChange={(pourquoiChoisir) => setForm((p) => ({ ...p, pourquoiChoisir }))}
            />
            <div className="mb-0">
              <label className="form-label" htmlFor="prochainesEtapes">
                Prochaines étapes
              </label>
              <textarea
                id="prochainesEtapes"
                className="form-control"
                rows={3}
                value={form.prochainesEtapes}
                onChange={(e) => setForm((p) => ({ ...p, prochainesEtapes: e.target.value }))}
                disabled={submitting}
              />
            </div>
          </div>
        )}
      </div>

      {/* —— Contact —— */}
      <div className="doc-form__section-card card mb-3">
        <button
          type="button"
          className="doc-form__section-toggle card-header d-flex align-items-center justify-content-between btn btn-link text-decoration-none text-body text-start w-100"
          onClick={() => toggle("contact")}
        >
          <span className="doc-form__section-title">Contact</span>
          <i className={`fi ${open.contact ? "fi-rr-angle-small-up" : "fi-rr-angle-small-down"}`} />
        </button>
        {open.contact && (
          <div className="card-body">
            <div className="row g-2">
              <div className="col-md-6">
                <label className="form-label" htmlFor="contact-nom">
                  Nom
                </label>
                <input
                  id="contact-nom"
                  className="form-control"
                  value={form.contact.nom}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, contact: { ...p.contact, nom: e.target.value } }))
                  }
                  disabled={submitting}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="contact-tel">
                  Téléphone
                </label>
                <input
                  id="contact-tel"
                  className="form-control"
                  value={form.contact.telephone}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      contact: { ...p.contact, telephone: e.target.value },
                    }))
                  }
                  disabled={submitting}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="contact-email">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className="form-control"
                  value={form.contact.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))
                  }
                  disabled={submitting}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="contact-tagline">
                  Tagline
                </label>
                <input
                  id="contact-tagline"
                  className="form-control"
                  value={form.contact.tagline}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      contact: { ...p.contact, tagline: e.target.value },
                    }))
                  }
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="doc-form__footer doc-form__footer--page">
        <button type="button" className="doc-form__btn doc-form__btn--ghost" onClick={onCancel} disabled={submitting}>
          Annuler
        </button>
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
