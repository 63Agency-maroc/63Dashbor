"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createClient,
  deleteClient,
  getClients,
  updateClient,
  type Client,
} from "@/lib/api/clients";
import { ApiError } from "@/lib/api/client";
import { AppToast } from "@/components/clients/AppToast";
import { ClientFormModal, toWriteDto, type ClientFormValues } from "@/components/clients/ClientFormModal";
import { DeleteClientModal } from "@/components/clients/DeleteClientModal";

type SortKey = "clientNom" | "clientEmail" | "clientTelephone" | "clientIce";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

function dash(value: string | undefined | null) {
  const v = (value ?? "").trim();
  return v.length ? v : "—";
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("clientNom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Client | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" } | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setListError(null);
    setForbidden(false);
    try {
      const items = await getClients();
      setClients(items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setClients([]);
        return;
      }
      setListError(err instanceof ApiError ? err.message : "Impossible de charger les clients.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = clients;
    if (q) {
      rows = clients.filter((c) =>
        [c.clientNom, c.clientEmail, c.clientTelephone, c.clientIce]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const av = (a[sortKey] ?? "").toString().toLowerCase();
      const bv = (b[sortKey] ?? "").toString().toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [clients, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(client: Client) {
    setFormMode("edit");
    setEditing(client);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleFormSubmit(values: ClientFormValues) {
    const dto = toWriteDto(values);
    if (!dto.clientNom) {
      setFormError("Le nom du client est requis.");
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        await createClient(dto);
        setToast({ message: "Client créé avec succès.", variant: "success" });
      } else if (editing) {
        // PATCH remplace les 4 champs — toujours tout envoyer
        await updateClient(editing.id, dto);
        setToast({ message: "Client mis à jour.", variant: "success" });
      }
      setFormOpen(false);
      await loadClients();
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
      await deleteClient(deleteTarget.id);
      setToast({ message: "Client supprimé.", variant: "success" });
      setDeleteTarget(null);
      await loadClients();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Suppression impossible.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <i className="fi fi-rr-sort-alt ms-1 text-muted opacity-50" />;
    return sortDir === "asc" ? (
      <i className="fi fi-rr-arrow-small-up ms-1" />
    ) : (
      <i className="fi fi-rr-arrow-small-down ms-1" />
    );
  };

  return (
    <div className="container-fluid">
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex flex-wrap gap-3 align-items-center justify-content-between">
        <div className="clearfix">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <a href="/">
                  <i className="fi fi-rr-home" /> Home
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Clients
              </li>
            </ol>
          </nav>
        </div>
        {!forbidden ? (
          <button type="button" className="btn-link border-0 bg-transparent p-0" onClick={openCreate}>
            <i className="fi fi-rr-plus me-1" /> New Customer
          </button>
        ) : null}
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card overflow-hidden">
            <div className="card-header d-flex flex-wrap gap-3 align-items-center justify-content-between border-0 pb-0">
              <h6 className="card-title mb-0">Customer List</h6>
              <div className="clearfix d-flex align-items-center gap-2">
                {/* TODO: pas d'API — filtre All Status (Active/Inactive) retiré */}
                <div className="position-relative">
                  <i className="fi fi-rr-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                  <input
                    type="search"
                    className="form-control form-control-sm ps-5"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={forbidden || loading}
                    style={{ minWidth: 200 }}
                  />
                </div>
              </div>
            </div>

            <div className="card-body px-1 pt-2 pb-2">
              {forbidden ? (
                <div className="text-center py-5 px-3">
                  <div className="avatar avatar-lg bg-warning-subtle text-warning rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
                    <i className="fi fi-rr-lock scale-2x" />
                  </div>
                  <h5 className="mb-2">Accès réservé aux administrateurs</h5>
                  <p className="text-muted mb-0">
                    Votre rôle ne permet pas de consulter ou gérer les clients.
                  </p>
                </div>
              ) : loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading…</span>
                  </div>
                  <p className="text-muted mt-3 mb-0">Chargement des clients…</p>
                </div>
              ) : listError ? (
                <div className="alert alert-danger m-3" role="alert">
                  {listError}
                  <button type="button" className="btn btn-sm btn-outline-danger ms-3" onClick={() => void loadClients()}>
                    Réessayer
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  {search.trim() ? "Aucun client ne correspond à la recherche." : "Aucun client."}
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table table-sm table-row-rounded mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="minw-200px" role="button" onClick={() => toggleSort("clientNom")}>
                            Name {sortIcon("clientNom")}
                          </th>
                          <th className="minw-150px" role="button" onClick={() => toggleSort("clientEmail")}>
                            Email {sortIcon("clientEmail")}
                          </th>
                          <th className="minw-150px" role="button" onClick={() => toggleSort("clientTelephone")}>
                            Phone {sortIcon("clientTelephone")}
                          </th>
                          <th className="minw-150px" role="button" onClick={() => toggleSort("clientIce")}>
                            ICE {sortIcon("clientIce")}
                          </th>
                          <th className="minw-100px">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <div className="d-flex align-items-center">
                                <div className="avatar avatar-xxs me-2 rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center">
                                  {(c.clientNom || "?").charAt(0).toUpperCase()}
                                </div>
                                {dash(c.clientNom)}
                              </div>
                            </td>
                            <td>{dash(c.clientEmail)}</td>
                            <td>{dash(c.clientTelephone)}</td>
                            <td>{dash(c.clientIce)}</td>
                            <td>
                              <div className="btn-group">
                                <button
                                  className="btn btn-subtle-primary btn-sm btn-shadow btn-icon waves-effect dropdown-toggle"
                                  type="button"
                                  data-bs-toggle="dropdown"
                                  aria-expanded="false"
                                >
                                  <i className="fi fi-rr-menu-dots" />
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end">
                                  <li>
                                    <button type="button" className="dropdown-item" onClick={() => openEdit(c)}>
                                      Edit
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      type="button"
                                      className="dropdown-item text-danger"
                                      onClick={() => {
                                        setDeleteError(null);
                                        setDeleteTarget(c);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between px-3 py-2 border-top">
                    <small className="text-muted">
                      {filtered.length} client{filtered.length > 1 ? "s" : ""}
                      {search.trim() ? ` (filtrés)` : ""} — page {currentPage}/{totalPages}
                    </small>
                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn btn-sm btn-white btn-shadow"
                        disabled={currentPage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-white btn-shadow"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ClientFormModal
        open={formOpen}
        mode={formMode}
        initial={editing}
        submitting={formSubmitting}
        error={formError}
        onClose={() => !formSubmitting && setFormOpen(false)}
        onSubmit={(v) => void handleFormSubmit(v)}
      />

      <DeleteClientModal
        open={!!deleteTarget}
        clientName={deleteTarget?.clientNom ?? ""}
        submitting={deleteSubmitting}
        error={deleteError}
        onClose={() => !deleteSubmitting && setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
