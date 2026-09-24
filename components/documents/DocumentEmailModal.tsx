"use client";

import { FormEvent, useEffect, useState } from "react";
import type { DocumentKind } from "@/lib/api/documents";

type Props = {
  open: boolean;
  kind: DocumentKind;
  numero: string;
  defaultTo: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { to: string; subject: string; message: string }) => void;
};

const LABELS: Record<DocumentKind, { title: string; noun: string }> = {
  devis: { title: "Envoyer le devis par email", noun: "devis" },
  facture: { title: "Envoyer la facture par email", noun: "facture" },
};

export function DocumentEmailModal({
  open,
  kind,
  numero,
  defaultTo,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const labels = LABELS[kind];
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setTo(defaultTo || "");
    setSubject(`Votre ${labels.noun} ${numero}`);
    setMessage(
      `Bonjour,\n\nVeuillez trouver ci-joint votre ${labels.noun} ${numero}.\n\nCordialement,\n63 AGENCY`,
    );
  }, [open, defaultTo, numero, labels.noun]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ to: to.trim(), subject: subject.trim(), message: message.trim() });
  }

  if (!open) return null;

  const idPrefix = `${kind}-email`;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{labels.title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={submitting} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error ? (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                ) : null}
                <p className="small text-muted">Le PDF sera joint automatiquement côté serveur.</p>
                <div className="mb-3">
                  <label className="form-label" htmlFor={`${idPrefix}-to`}>
                    Destinataire <span className="text-danger">*</span>
                  </label>
                  <input
                    id={`${idPrefix}-to`}
                    type="email"
                    className="form-control"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor={`${idPrefix}-subject`}>
                    Objet <span className="text-danger">*</span>
                  </label>
                  <input
                    id={`${idPrefix}-subject`}
                    className="form-control"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label" htmlFor={`${idPrefix}-message`}>
                    Message <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id={`${idPrefix}-message`}
                    className="form-control"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={onClose} disabled={submitting}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" /> Envoi…
                    </>
                  ) : (
                    "Envoyer"
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
