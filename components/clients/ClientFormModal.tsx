"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Client, ClientWriteDto } from "@/lib/api/clients";

export type ClientFormValues = {
  clientNom: string;
  clientEmail: string;
  clientTelephone: string;
  clientIce: string;
};

const emptyForm: ClientFormValues = {
  clientNom: "",
  clientEmail: "",
  clientTelephone: "",
  clientIce: "",
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Client | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => void;
};

export function ClientFormModal({ open, mode, initial, submitting, error, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ClientFormValues>(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setForm({
        clientNom: initial.clientNom ?? "",
        clientEmail: initial.clientEmail ?? "",
        clientTelephone: initial.clientTelephone ?? "",
        clientIce: initial.clientIce ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, initial]);

  function setField<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <>
      <div
        className={`modal fade${open ? " show" : ""}`}
        id="clientFormModal"
        tabIndex={-1}
        aria-labelledby="clientFormModalLabel"
        aria-hidden={!open}
        style={open ? { display: "block" } : undefined}
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="clientFormModalLabel">
                {mode === "create" ? "New Customer" : "Edit Customer"}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={submitting} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error ? (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                ) : null}
                <div className="row">
                  <div className="col-lg-6 mb-3">
                    <label className="form-label" htmlFor="clientNom">
                      Customer Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="clientNom"
                      type="text"
                      className="form-control"
                      placeholder="Enter full name"
                      value={form.clientNom}
                      onChange={(e) => setField("clientNom", e.target.value)}
                      required
                      minLength={1}
                      maxLength={200}
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label" htmlFor="clientEmail">
                      Email Address
                    </label>
                    <input
                      id="clientEmail"
                      type="email"
                      className="form-control"
                      placeholder="Enter email"
                      value={form.clientEmail}
                      onChange={(e) => setField("clientEmail", e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label" htmlFor="clientTelephone">
                      Phone Number
                    </label>
                    <input
                      id="clientTelephone"
                      type="text"
                      className="form-control"
                      placeholder="e.g. +212 6XX XXX XXX"
                      value={form.clientTelephone}
                      onChange={(e) => setField("clientTelephone", e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label" htmlFor="clientIce">
                      ICE
                    </label>
                    <input
                      id="clientIce"
                      type="text"
                      className="form-control"
                      placeholder="ICE"
                      value={form.clientIce}
                      onChange={(e) => setField("clientIce", e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  {/* TODO: pas d'API — Company / Country / Type / Status / Joined Date retirés */}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={onClose} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary ms-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Saving…
                    </>
                  ) : mode === "create" ? (
                    "Add Customer"
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {open ? <div className="modal-backdrop fade show" onClick={onClose} /> : null}
    </>
  );
}

export function toWriteDto(values: ClientFormValues): Required<ClientWriteDto> {
  return {
    clientNom: values.clientNom.trim(),
    clientEmail: values.clientEmail.trim(),
    clientTelephone: values.clientTelephone.trim(),
    clientIce: values.clientIce.trim(),
  };
}
