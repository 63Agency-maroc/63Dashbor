"use client";

import { FormEvent, useEffect, useState } from "react";

type Props = {
  open: boolean;
  numero: string;
  defaultTo: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { to: string; subject: string; message: string }) => void;
};

export function PropositionEmailModal({
  open,
  numero,
  defaultTo,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setTo(defaultTo || "");
    setSubject(`Votre proposition ${numero}`);
    setMessage(
      `Bonjour,\n\nVeuillez trouver ci-joint votre proposition ${numero}.\n\nCordialement,\n63 AGENCY`,
    );
  }, [open, defaultTo, numero]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ to: to.trim(), subject: subject.trim(), message: message.trim() });
  }

  if (!open) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Envoyer la proposition par email</h5>
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
                  <label className="form-label" htmlFor="prop-email-to">
                    Destinataire <span className="text-danger">*</span>
                  </label>
                  <input
                    id="prop-email-to"
                    type="email"
                    className="form-control"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="prop-email-subject">
                    Objet <span className="text-danger">*</span>
                  </label>
                  <input
                    id="prop-email-subject"
                    className="form-control"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label" htmlFor="prop-email-message">
                    Message <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="prop-email-message"
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
