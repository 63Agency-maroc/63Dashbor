"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  createDevis,
  deleteDevis,
  downloadBlob,
  getDevis,
  getDevisById,
  getDevisPdfBlob,
  sendDevisEmail,
  transferToFacture,
  updateDevis,
  type Devis,
  type DevisListItem,
  type UpsertDevisDto,
} from "@/lib/api/devis";
import { AppToast } from "@/components/clients/AppToast";
import { DevisEmailModal } from "@/components/devis/DevisEmailModal";
import { DevisFormModal } from "@/components/devis/DevisFormModal";

const PAGE_SIZE = 10;

type SortKey = "numero" | "clientNom" | "dateEmission" | "totalTtc" | "status";
type SortDir = "asc" | "desc";

function dash(v: string | number | null | undefined) {
  if (v == null || v === "") return "—";
  return String(v);
}

function money(n: number | undefined | null) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(ymd: string | undefined) {
  if (!ymd) return "—";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "draft" || s === "brouillon") return "bg-secondary-subtle text-secondary";
  if (s === "sent" || s === "envoyé" || s === "envoye") return "bg-info-subtle text-info";
  if (s === "accepted" || s === "accepté" || s === "accepte") return "bg-success-subtle text-success";
  if (s === "rejected" || s === "refusé" || s === "refuse") return "bg-danger-subtle text-danger";
  return "bg-warning-subtle text-warning";
}

export default function DevisPage() {
  const [items, setItems] = useState<DevisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dateEmission");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Devis | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DevisListItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [emailTarget, setEmailTarget] = useState<DevisListItem | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [transferTarget, setTransferTarget] = useState<DevisListItem | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "danger" | "info";
  } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    setForbidden(false);
    try {
      const res = await getDevis();
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setItems([]);
        return;
      }
      setListError(err instanceof ApiError ? err.message : "Impossible de charger les devis.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items;
    if (q) {
      rows = items.filter((d) =>
        [d.numero, d.clientNom, d.status, d.clientEmail, d.clientTelephone]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "totalTtc") {
        av = a.totals?.totalTtc ?? 0;
        bv = b.totals?.totalTtc ?? 0;
      } else {
        av = (a[sortKey] ?? "").toString().toLowerCase();
        bv = (b[sortKey] ?? "").toString().toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [items, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "dateEmission" || key === "totalTtc" ? "desc" : "asc");
    }
  }

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }

  async function openEdit(row: DevisListItem) {
    setFormError(null);
    setFormLoading(true);
    try {
      const full = await getDevisById(row.id);
      setEditing(full);
      setFormMode("edit");
      setFormOpen(true);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Impossible de charger le devis.",
        variant: "danger",
      });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleFormSubmit(dto: UpsertDevisDto) {
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        await createDevis(dto);
        setToast({ message: "Devis créé.", variant: "success" });
      } else if (editing?.id) {
        await updateDevis(editing.id, dto);
        setToast({ message: "Devis mis à jour.", variant: "success" });
      }
      setFormOpen(false);
      setEditing(null);
      void loadList();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteDevis(deleteTarget.id);
      setToast({ message: `Devis ${deleteTarget.numero} supprimé.`, variant: "success" });
      setDeleteTarget(null);
      void loadList();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Suppression impossible.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handlePdf(row: DevisListItem) {
    setPdfBusyId(row.id);
    try {
      const blob = await getDevisPdfBlob(row.id);
      downloadBlob(blob, `${row.numero || "devis"}.pdf`);
      setToast({ message: "PDF téléchargé.", variant: "success" });
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Téléchargement PDF impossible.",
        variant: "danger",
      });
    } finally {
      setPdfBusyId(null);
    }
  }

  async function handleEmailSubmit(values: { to: string; subject: string; message: string }) {
    if (!emailTarget) return;
    setEmailSubmitting(true);
    setEmailError(null);
    try {
      await sendDevisEmail(emailTarget.id, values);
      setToast({ message: "Email envoyé.", variant: "success" });
      setEmailTarget(null);
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : "Envoi impossible.");
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function handleTransfer() {
    if (!transferTarget) return;
    setTransferSubmitting(true);
    try {
      const facture = await transferToFacture(transferTarget.id, {});
      const num = facture?.numero ? ` ${facture.numero}` : "";
      setToast({
        message: `Facture créée${num}.`,
        variant: "success",
      });
      setTransferTarget(null);
      void loadList();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Transfert impossible.",
        variant: "danger",
      });
    } finally {
      setTransferSubmitting(false);
    }
  }

  if (forbidden) {
    return (
      <div className="container-fluid">
        <div className="app-page-head">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <a href="/">
                  <i className="fi fi-rr-home" /> Home
                </a>
              </li>
              <li className="breadcrumb-item active">Devis</li>
            </ol>
          </nav>
        </div>
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="avatar avatar-lg bg-warning-subtle text-warning rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
              <i className="fi fi-rr-lock scale-2x" />
            </div>
            <h5 className="mb-2">Accès non autorisé</h5>
            <p className="text-muted mb-0">La gestion des devis est réservée aux administrateurs.</p>
          </div>
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

      <div className="app-page-head d-flex flex-wrap gap-3 align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Devis
            </li>
          </ol>
        </nav>
        <button type="button" className="btn btn-primary" onClick={openCreate} disabled={formLoading}>
          <i className="fi fi-rr-plus me-1" /> Nouveau devis
        </button>
      </div>

      <div className="card">
        <div className="card-header d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <h5 className="card-title mb-0">Liste des devis</h5>
          <div className="d-flex gap-2 align-items-center">
            <input
              type="search"
              className="form-control form-control-sm"
              style={{ minWidth: 220 }}
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={() => void loadList()}
              disabled={loading}
            >
              Actualiser
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          {listError && (
            <div className="alert alert-danger m-3 mb-0" role="alert">
              {listError}
            </div>
          )}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    {(
                      [
                        ["numero", "N°"],
                        ["clientNom", "Client"],
                        ["dateEmission", "Date"],
                        ["totalTtc", "Total TTC"],
                        ["status", "Statut"],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key}>
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-decoration-none p-0 text-body"
                          onClick={() => toggleSort(key)}
                        >
                          {label}
                          {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                      </th>
                    ))}
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-5">
                        Aucun devis
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td className="fw-medium">{dash(row.numero)}</td>
                        <td>{dash(row.clientNom)}</td>
                        <td>{formatDate(row.dateEmission)}</td>
                        <td className="font-monospace">{money(row.totals?.totalTtc)} MAD</td>
                        <td>
                          <span className={`badge ${statusBadge(row.status)}`}>{dash(row.status)}</span>
                        </td>
                        <td className="text-end">
                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn-sm btn-subtle-primary"
                              title="Éditer"
                              onClick={() => void openEdit(row)}
                            >
                              <i className="fi fi-rr-pencil" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-subtle-secondary"
                              title="PDF"
                              disabled={pdfBusyId === row.id}
                              onClick={() => void handlePdf(row)}
                            >
                              {pdfBusyId === row.id ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                <i className="fi fi-rr-file-pdf" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-subtle-info"
                              title="Email"
                              onClick={() => {
                                setEmailError(null);
                                setEmailTarget(row);
                              }}
                            >
                              <i className="fi fi-rr-envelope" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-subtle-success"
                              title="Transférer en facture"
                              data-bs-toggle="tooltip"
                              data-bs-title="Transférer en facture"
                              onClick={() => setTransferTarget(row)}
                            >
                              <i className="fi fi-rr-exchange" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-subtle-danger"
                              title="Supprimer"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(row);
                              }}
                            >
                              <i className="fi fi-rr-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="card-footer d-flex justify-content-between align-items-center">
            <button
              type="button"
              className="btn btn-sm btn-light"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </button>
            <span className="small text-muted">
              Page {currentPage} / {totalPages} · {filtered.length} devis
            </span>
            <button
              type="button"
              className="btn btn-sm btn-light"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      <DevisFormModal
        open={formOpen}
        mode={formMode}
        initial={editing}
        submitting={formSubmitting}
        error={formError}
        onClose={() => {
          if (formSubmitting) return;
          setFormOpen(false);
          setEditing(null);
          setFormError(null);
        }}
        onSubmit={(dto) => void handleFormSubmit(dto)}
      />

      <DevisEmailModal
        open={Boolean(emailTarget)}
        numero={emailTarget?.numero ?? ""}
        defaultTo={emailTarget?.clientEmail ?? ""}
        submitting={emailSubmitting}
        error={emailError}
        onClose={() => {
          if (emailSubmitting) return;
          setEmailTarget(null);
          setEmailError(null);
        }}
        onSubmit={(v) => void handleEmailSubmit(v)}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <>
          <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Supprimer le devis</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleteSubmitting}
                  />
                </div>
                <div className="modal-body">
                  {deleteError && (
                    <div className="alert alert-danger" role="alert">
                      {deleteError}
                    </div>
                  )}
                  <p className="mb-0">
                    Supprimer <strong>{deleteTarget.numero}</strong> ({deleteTarget.clientNom}) ? Action
                    irréversible.
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleteSubmitting}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void handleDelete()}
                    disabled={deleteSubmitting}
                  >
                    {deleteSubmitting ? "Suppression…" : "Supprimer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}

      {/* Transfer confirm */}
      {transferTarget && (
        <>
          <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title d-flex align-items-center gap-2">
                    <i className="fi fi-rr-exchange" aria-hidden />
                    Transférer en facture
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setTransferTarget(null)}
                    disabled={transferSubmitting}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Créer une facture à partir du devis <strong>{transferTarget.numero}</strong>{" "}
                    ({transferTarget.clientNom}) ? Copie simple (body vide).
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => setTransferTarget(null)}
                    disabled={transferSubmitting}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => void handleTransfer()}
                    disabled={transferSubmitting}
                  >
                    {transferSubmitting ? "Transfert…" : "Créer la facture"}
                  </button>
                  {transferTarget && (
                    <Link href="/factures" className="btn btn-outline-secondary btn-sm ms-auto">
                      Voir factures
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
}
