"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { updateMyProfile } from "@/lib/api/users";
import { uploadImage } from "@/lib/api/upload";
import { useAuth } from "@/components/providers/AuthProvider";
import { AppToast } from "@/components/clients/AppToast";
import {
  avatarUrl as resolveAvatarUrl,
  displayName,
  roleLabel,
  userInitials,
  type AuthUser,
} from "@/lib/auth/storage";
import { MOROCCO_CITIES } from "@/lib/constants/morocco-cities";
import { Select } from "@/components/ui/Select";

function formatJoined(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function ProfilePage() {
  const { user, isLoading, applyUser, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [bio, setBio] = useState("");

  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "danger" | "info";
  } | null>(null);

  // Sync form depuis le user context
  useEffect(() => {
    if (!user) return;
    setPrenom(String(user.prenom ?? ""));
    setNom(String(user.nom ?? ""));
    setTelephone(String(user.telephone ?? ""));
    setVille(String(user.ville ?? ""));
    setBio(String(user.bio ?? ""));
    setAvatarPreview(null);
  }, [user]);

  const fullName = useMemo(() => displayName(user), [user]);
  const email = user?.email ?? "";
  const role = roleLabel(typeof user?.role === "string" ? user.role : undefined);
  const avatarSrc = avatarPreview || resolveAvatarUrl(user);
  const hasCustomAvatar = Boolean(
    avatarPreview || user?.avatarUrl || user?.avatar || user?.photo || user?.image,
  );
  const initials = userInitials(user);

  function mergeUser(patch: Partial<AuthUser>): AuthUser {
    return { ...(user ?? {}), ...patch };
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    const p = prenom.trim();
    const n = nom.trim();
    if (!p || !n) {
      setProfileError("Prénom et nom sont requis.");
      return;
    }
    setProfileBusy(true);
    setProfileError(null);
    try {
      const dto = {
        prenom: p,
        nom: n,
        telephone: telephone.trim() || undefined,
        ville: ville.trim() || undefined,
        bio: bio.trim() || undefined,
      };
      const updated = await updateMyProfile(dto);
      applyUser(updated?.id != null ? updated : mergeUser(dto));
      // Assure topbar à jour même si PATCH renvoie un user partiel
      try {
        await refreshUser();
      } catch {
        /* applyUser suffit */
      }
      setToast({ message: "Profil mis à jour.", variant: "success" });
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Mise à jour impossible.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleAvatarFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Choisissez une image (JPG, PNG, WebP…).");
      return;
    }
    setAvatarError(null);
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setAvatarBusy(true);
    try {
      const uploaded = await uploadImage(file);
      const secureUrl = uploaded.url;
      const updated = await updateMyProfile({ avatarUrl: secureUrl });
      applyUser(
        updated?.id != null
          ? { ...mergeUser({ avatarUrl: secureUrl }), ...updated }
          : mergeUser({ avatarUrl: secureUrl }),
      );
      try {
        await refreshUser();
      } catch {
        /* ok */
      }
      setAvatarPreview(null);
      setToast({ message: "Photo de profil mise à jour.", variant: "success" });
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : "Upload impossible.");
      setAvatarPreview(null);
    } finally {
      setAvatarBusy(false);
      URL.revokeObjectURL(localUrl);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (isLoading && !user) {
    return (
      <div className="container-fluid">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Profile
            </li>
          </ol>
        </nav>
      </div>

      <div className="row">
        {/* —— Carte profil —— */}
        <div className="col-lg-4 col-sm-12">
          <div className="card">
            <div className="card-header pb-0 border-0">
              <div className="mb-4 border-bottom pb-4 d-flex border-0 justify-content-between align-items-start">
                <div className="d-flex align-items-center">
                  {/* Wrapper sans overflow : l’icône caméra reste hors du cercle */}
                  <div className="position-relative me-3 flex-shrink-0" style={{ width: 72, height: 72 }}>
                    <div
                      className="avatar avatar-xl rounded-circle bg-primary-subtle overflow-hidden w-100 h-100"
                      style={{ width: 72, height: 72 }}
                    >
                      {hasCustomAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarSrc} alt="" className="w-100 h-100" style={{ objectFit: "cover" }} />
                      ) : (
                        <span className="d-flex align-items-center justify-content-center w-100 h-100 fw-bold text-primary">
                          {initials}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-icon rounded-circle border border-2 border-white shadow-sm position-absolute d-flex align-items-center justify-content-center p-0"
                      style={{
                        width: 28,
                        height: 28,
                        bottom: -2,
                        right: -2,
                        zIndex: 2,
                      }}
                      title="Changer la photo"
                      disabled={avatarBusy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {avatarBusy ? (
                        <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} />
                      ) : (
                        <i className="fi fi-rr-camera" style={{ fontSize: 12 }} />
                      )}
                    </button>
                  </div>
                  <div className="clearfix">
                    <h4 className="fw-bold mb-0">{fullName}</h4>
                    <small className="mb-0 text-muted d-block">{email || "—"}</small>
                    <span className="badge bg-primary-subtle text-primary mt-1">{role}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              <div className="mb-0">
                <h5 className="card-title mb-3">Informations de base</h5>
                <div className="mb-3">
                  <span className="mb-1 d-block text-muted small">Email</span>
                  <p className="text-dark fw-semibold mb-0">{email || "—"}</p>
                </div>
                <div className="mb-3">
                  <span className="mb-1 d-block text-muted small">Rôle</span>
                  <p className="text-dark fw-semibold mb-0">{role}</p>
                </div>
                <div className="mb-3">
                  <span className="mb-1 d-block text-muted small">Téléphone</span>
                  <p className="text-dark fw-semibold mb-0">{telephone || "—"}</p>
                </div>
                <div className="mb-3">
                  <span className="mb-1 d-block text-muted small">Ville</span>
                  <p className="text-dark fw-semibold mb-0">{ville || "—"}</p>
                </div>
                {bio ? (
                  <div className="mb-3">
                    <span className="mb-1 d-block text-muted small">Bio</span>
                    <p className="text-dark fw-semibold mb-0" style={{ whiteSpace: "pre-wrap" }}>
                      {bio}
                    </p>
                  </div>
                ) : null}
                <div className="mb-0">
                  <span className="mb-1 d-block text-muted small">Membre depuis</span>
                  <p className="text-dark fw-semibold mb-0">{formatJoined(user?.createdAt)}</p>
                </div>
              </div>

              <div className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="d-none"
                  onChange={(e) => void handleAvatarFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarBusy ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" /> Upload…
                    </>
                  ) : (
                    <>
                      <i className="fi fi-rr-camera me-1" /> Changer la photo
                    </>
                  )}
                </button>
                {avatarError ? (
                  <div className="alert alert-danger mt-2 mb-0 py-2 small" role="alert">
                    {avatarError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* —— Formulaires —— */}
        <div className="col-lg-8 col-sm-12">
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Informations personnelles</h4>
            </div>
            <div className="card-body">
              {profileError ? (
                <div className="alert alert-danger" role="alert">
                  {profileError}
                </div>
              ) : null}
              <form onSubmit={handleProfileSubmit}>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-prenom">
                      Prénom <span className="text-danger">*</span>
                    </label>
                    <input
                      id="profile-prenom"
                      className="form-control"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      required
                      disabled={profileBusy}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-nom">
                      Nom <span className="text-danger">*</span>
                    </label>
                    <input
                      id="profile-nom"
                      className="form-control"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                      disabled={profileBusy}
                    />
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-email">
                      Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      className="form-control"
                      value={email}
                      readOnly
                      disabled
                    />
                    <div className="form-text">Non modifiable</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-role">
                      Rôle
                    </label>
                    <input
                      id="profile-role"
                      className="form-control"
                      value={role}
                      readOnly
                      disabled
                    />
                    <div className="form-text">Non modifiable</div>
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-tel">
                      Téléphone
                    </label>
                    <input
                      id="profile-tel"
                      type="tel"
                      className="form-control"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      disabled={profileBusy}
                      placeholder="+212 …"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-ville">
                      Ville
                    </label>
                    <Select
                      id="profile-ville"
                      value={ville}
                      onChange={setVille}
                      disabled={profileBusy}
                      placeholder="Sélectionner une ville"
                      searchable
                      options={[
                        { value: "", label: "Sélectionner une ville" },
                        ...(ville && !(MOROCCO_CITIES as readonly string[]).includes(ville)
                          ? [{ value: ville, label: ville }]
                          : []),
                        ...MOROCCO_CITIES.map((city) => ({ value: city, label: city })),
                      ]}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="profile-bio">
                    Bio
                  </label>
                  <textarea
                    id="profile-bio"
                    className="form-control"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    disabled={profileBusy}
                    placeholder="Quelques mots sur vous…"
                    maxLength={500}
                  />
                  <div className="form-text">{bio.length}/500</div>
                </div>
                <div className="text-end">
                  <button type="submit" className="btn btn-primary" disabled={profileBusy}>
                    {profileBusy ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" /> Enregistrement…
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
