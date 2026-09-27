"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  USER_ROLES,
  type CreateUserDto,
  type Employee,
  type UpdateUserDto,
  type UserRole,
} from "@/lib/api/users";
import { roleLabel } from "@/lib/auth/storage";
import { uploadImage } from "@/lib/api/upload";
import { Select } from "@/components/ui/Select";

export type EmployeeFormValues = {
  prenom: string;
  nom: string;
  email: string;
  password: string;
  role: UserRole | string;
  telephone: string;
  ville: string;
  avatarUrl: string;
};

const emptyForm: EmployeeFormValues = {
  prenom: "",
  nom: "",
  email: "",
  password: "",
  role: "fixed_meeting",
  telephone: "",
  ville: "",
  avatarUrl: "",
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Employee | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateUserDto | UpdateUserDto) => void;
};

export function EmployeeFormModal({
  open,
  mode,
  initial,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<EmployeeFormValues>(emptyForm);
  const [localError, setLocalError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setForm({
        prenom: initial.prenom ?? "",
        nom: initial.nom ?? "",
        email: initial.email ?? "",
        password: "",
        role: initial.role || "fixed_meeting",
        telephone: initial.telephone ?? "",
        ville: initial.ville ?? "",
        avatarUrl: initial.avatarUrl ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, initial]);

  function setField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onAvatarFile(file: File | null) {
    if (!file) return;
    setAvatarBusy(true);
    setLocalError(null);
    try {
      const uploaded = await uploadImage(file);
      setField("avatarUrl", uploaded.url);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload avatar impossible.");
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const prenom = form.prenom.trim();
    const nom = form.nom.trim();
    const email = form.email.trim();
    const password = form.password;
    const role = form.role;
    const telephone = form.telephone.trim();
    const ville = form.ville.trim();
    const avatarUrl = form.avatarUrl.trim();

    if (!prenom || !nom || !email) {
      setLocalError("Prénom, nom et e-mail sont requis.");
      return;
    }
    if (mode === "create") {
      if (password.length < 8) {
        setLocalError("Le mot de passe doit contenir au moins 8 caractères.");
        return;
      }
      const dto: CreateUserDto = {
        prenom,
        nom,
        email,
        password,
        role,
      };
      if (telephone) dto.telephone = telephone;
      if (ville) dto.ville = ville;
      onSubmit(dto);
      return;
    }

    const dto: UpdateUserDto = {
      prenom,
      nom,
      email,
      role,
      telephone: telephone || undefined,
      ville: ville || undefined,
    };
    if (password.trim()) {
      if (password.length < 8) {
        setLocalError("Le mot de passe doit contenir au moins 8 caractères.");
        return;
      }
      dto.password = password;
    }
    const prevAvatar = (initial?.avatarUrl ?? "").trim();
    if (avatarUrl !== prevAvatar) {
      dto.avatarUrl = avatarUrl;
    }
    onSubmit(dto);
  }

  if (!open) return null;

  const displayError = localError || error;
  const busy = submitting || avatarBusy;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content employees-modal">
            <div className="modal-header py-3">
              <h5 className="modal-title">
                {mode === "create" ? "Add Employee" : "Edit Employee"}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={busy} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {displayError ? (
                  <div className="alert alert-danger py-2" role="alert">
                    {displayError}
                  </div>
                ) : null}

                {mode === "edit" ? (
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div className="employees-avatar employees-avatar--lg">
                      {form.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.avatarUrl} alt="" />
                      ) : (
                        <span>
                          {(form.prenom.charAt(0) + form.nom.charAt(0)).toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="small text-muted mb-1">Avatar</div>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-white btn-shadow"
                          disabled={busy}
                          onClick={() => fileRef.current?.click()}
                        >
                          {avatarBusy ? "Upload…" : "Changer l’image"}
                        </button>
                        {form.avatarUrl ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-light"
                            disabled={busy}
                            onClick={() => setField("avatarUrl", "")}
                          >
                            Retirer
                          </button>
                        ) : null}
                      </div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="d-none"
                        onChange={(e) => void onAvatarFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="emp-prenom">
                      Prénom <span className="text-danger">*</span>
                    </label>
                    <input
                      id="emp-prenom"
                      type="text"
                      className="form-control"
                      value={form.prenom}
                      onChange={(e) => setField("prenom", e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="emp-nom">
                      Nom <span className="text-danger">*</span>
                    </label>
                    <input
                      id="emp-nom"
                      type="text"
                      className="form-control"
                      value={form.nom}
                      onChange={(e) => setField("nom", e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="emp-email">
                      E-mail <span className="text-danger">*</span>
                    </label>
                    <input
                      id="emp-email"
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="emp-password">
                      Mot de passe
                      {mode === "create" ? <span className="text-danger"> *</span> : null}
                    </label>
                    <input
                      id="emp-password"
                      type="password"
                      className="form-control"
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      required={mode === "create"}
                      minLength={mode === "create" ? 8 : undefined}
                      placeholder={mode === "edit" ? "Laisser vide pour ne pas changer" : "≥ 8 caractères"}
                      autoComplete="new-password"
                      disabled={busy}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Rôle <span className="text-danger">*</span></label>
                    <Select
                      value={form.role}
                      onChange={(v) => setField("role", v)}
                      disabled={busy}
                      required
                      options={USER_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
                      aria-label="Rôle"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="emp-tel">
                      Téléphone
                    </label>
                    <input
                      id="emp-tel"
                      type="text"
                      className="form-control"
                      value={form.telephone}
                      onChange={(e) => setField("telephone", e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="emp-ville">
                      Ville
                    </label>
                    <input
                      id="emp-ville"
                      type="text"
                      className="form-control"
                      value={form.ville}
                      onChange={(e) => setField("ville", e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  {mode === "edit" ? (
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="emp-avatar-url">
                        URL avatar
                      </label>
                      <input
                        id="emp-avatar-url"
                        type="url"
                        className="form-control"
                        value={form.avatarUrl}
                        onChange={(e) => setField("avatarUrl", e.target.value)}
                        placeholder="https://…"
                        disabled={busy}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className={`btn ${mode === "create" ? "btn-success" : "btn-primary"}`} disabled={busy}>
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                      Saving…
                    </>
                  ) : mode === "create" ? (
                    "Add Employee"
                  ) : (
                    "Save"
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
