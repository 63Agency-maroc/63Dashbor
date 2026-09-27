"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApiError } from "@/lib/api/client";
import {
  createUser,
  deleteUser,
  employeeFullName,
  employeeInitials,
  getUsers,
  normalizeEmployee,
  normalizePresenceUpdate,
  updateUser,
  USER_ROLES,
  type CreateUserDto,
  type Employee,
  type UpdateUserDto,
} from "@/lib/api/users";
import { roleLabel } from "@/lib/auth/storage";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { getSocket } from "@/lib/realtime/socket";
import { Select } from "@/components/ui/Select";
import { AppToast } from "@/components/clients/AppToast";
import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { DeleteEmployeeModal } from "@/components/employees/DeleteEmployeeModal";

const PAGE_SIZE = 8;

function dash(value: string | undefined | null) {
  const v = (value ?? "").trim();
  return v.length ? v : "—";
}

export default function EmployeesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = (user?.role ?? "") === "admin";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "email" | "role">("name");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" } | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!isAdmin) {
      setForbidden(true);
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);
    setForbidden(false);
    try {
      const items = await getUsers();
      setEmployees(items);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setForbidden(true);
        setEmployees([]);
        return;
      }
      setListError(err instanceof ApiError ? err.message : "Impossible de charger les employés.");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    void loadEmployees();
  }, [authLoading, loadEmployees]);

  useEffect(() => {
    if (!isAdmin || forbidden) return;
    let socket;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onPresence = (raw: unknown) => {
      const ev = normalizePresenceUpdate(raw);
      if (!ev) return;
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === ev.userId
            ? { ...e, online: ev.online, lastSeen: ev.lastSeen ?? e.lastSeen }
            : e,
        ),
      );
    };

    const onCreated = (raw: unknown) => {
      const emp = normalizeEmployee(raw);
      if (!emp.id) return;
      setEmployees((prev) => {
        if (prev.some((e) => e.id === emp.id)) {
          return prev.map((e) => (e.id === emp.id ? { ...e, ...emp } : e));
        }
        return [emp, ...prev];
      });
    };

    const onUpdated = (raw: unknown) => {
      const emp = normalizeEmployee(raw);
      if (!emp.id) return;
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, ...emp } : e)));
    };

    const onDeleted = (raw: unknown) => {
      const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const id = String(o.id ?? o.userId ?? o.user_id ?? "");
      if (!id) return;
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    };

    socket.on("presence:update", onPresence);
    socket.on("employee:created", onCreated);
    socket.on("employee:updated", onUpdated);
    socket.on("employee:deleted", onDeleted);

    return () => {
      socket.off("presence:update", onPresence);
      socket.off("employee:created", onCreated);
      socket.off("employee:updated", onUpdated);
      socket.off("employee:deleted", onDeleted);
    };
  }, [isAdmin, forbidden]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = employees;
    if (onlineOnly) rows = rows.filter((e) => e.online);
    if (roleFilter) rows = rows.filter((e) => e.role === roleFilter);
    if (q) {
      rows = rows.filter((e) => {
        const hay = [employeeFullName(e), e.email, e.role, roleLabel(e.role), e.telephone ?? "", e.ville ?? ""]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return [...rows].sort((a, b) => {
      let av = "";
      let bv = "";
      if (sortKey === "email") {
        av = a.email;
        bv = b.email;
      } else if (sortKey === "role") {
        av = roleLabel(a.role);
        bv = roleLabel(b.role);
      } else {
        av = employeeFullName(a);
        bv = employeeFullName(b);
      }
      return av.localeCompare(bv, "fr", { sensitivity: "base" });
    });
  }, [employees, search, roleFilter, onlineOnly, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, onlineOnly, sortKey]);

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(emp: Employee) {
    setFormMode("edit");
    setEditing(emp);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleFormSubmit(payload: CreateUserDto | UpdateUserDto) {
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        const created = await createUser(payload as CreateUserDto);
        setEmployees((prev) => {
          if (prev.some((e) => e.id === created.id)) {
            return prev.map((e) => (e.id === created.id ? created : e));
          }
          return [created, ...prev];
        });
        setToast({ message: "Employé créé avec succès.", variant: "success" });
      } else if (editing) {
        const updated = await updateUser(editing.id, payload as UpdateUserDto);
        setEmployees((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
        setToast({ message: "Employé mis à jour.", variant: "success" });
      }
      setFormOpen(false);
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
      await deleteUser(deleteTarget.id);
      setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setToast({ message: "Employé supprimé.", variant: "success" });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Suppression impossible.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="container-fluid py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div className="container-fluid employees-page">
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      {/* NexLink employee.html — page head */}
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
                Employee
              </li>
            </ol>
          </nav>
        </div>
        {!forbidden ? (
          <button type="button" className="btn-link border-0 bg-transparent p-0" onClick={openCreate}>
            <i className="fi fi-rr-plus me-1" aria-hidden /> Add Employee
          </button>
        ) : null}
      </div>

      {forbidden ? (
        <div className="alert alert-warning" role="alert">
          Accès réservé aux administrateurs.
        </div>
      ) : (
        <>
          <div className="card border-0 shadow-none mb-3 employees-toolbar">
            <div className="card-body py-2 px-0">
              <div className="d-flex flex-column flex-lg-row flex-wrap align-items-stretch align-items-lg-center gap-2">
                <div className="position-relative flex-grow-1" style={{ minWidth: 180, maxWidth: 320 }}>
                  <i className="fi fi-rr-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                  <input
                    type="search"
                    className="form-control ps-5"
                    placeholder="Search name, email, role…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select
                  className="flex-shrink-0"
                  style={{ width: 180 }}
                  value={roleFilter}
                  onChange={setRoleFilter}
                  placeholder="All roles"
                  options={[
                    { value: "", label: "All roles" },
                    ...USER_ROLES.map((r) => ({ value: r, label: roleLabel(r) })),
                  ]}
                  aria-label="Filter by role"
                />
                <Select
                  className="flex-shrink-0"
                  style={{ width: 160 }}
                  value={sortKey}
                  onChange={(v) => setSortKey(v as typeof sortKey)}
                  options={[
                    { value: "name", label: "Sort: Name" },
                    { value: "email", label: "Sort: Email" },
                    { value: "role", label: "Sort: Role" },
                  ]}
                  aria-label="Sort"
                />
                <label className="employees-online-toggle mb-0">
                  <input
                    type="checkbox"
                    className="form-check-input m-0"
                    checked={onlineOnly}
                    onChange={(e) => setOnlineOnly(e.target.checked)}
                  />
                  <span>En ligne uniquement</span>
                </label>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="text-muted mt-3 mb-0">Chargement des employés…</p>
            </div>
          ) : listError ? (
            <div className="alert alert-danger" role="alert">
              {listError}
              <button type="button" className="btn btn-sm btn-outline-danger ms-3" onClick={() => void loadEmployees()}>
                Réessayer
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              {search.trim() || roleFilter || onlineOnly
                ? "Aucun employé ne correspond aux filtres."
                : "Aucun employé."}
            </div>
          ) : (
            <>
              {/* NexLink employee.html — card grid */}
              <div className="row">
                {pageRows.map((e) => {
                  const name = employeeFullName(e);
                  const statusClass = e.online
                    ? "avatar-status-success"
                    : "avatar-status-secondary";
                  return (
                    <div className="col-xxl-3 col-lg-4 col-md-6" key={e.id}>
                      <div className={`card${e.online ? " bg-success-subtle border-0" : ""}`}>
                        <div className="card-header d-flex align-items-center justify-content-between border-0 pb-0 p-3">
                          {e.online ? (
                            <span className="badge bg-success-subtle text-success">En ligne</span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary">Hors ligne</span>
                          )}
                          <div className="clearfix">
                            <div className="btn-group">
                              <button
                                className="btn btn-white btn-sm btn-shadow btn-icon waves-effect dropdown-toggle"
                                type="button"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="fi fi-rr-menu-dots" />
                              </button>
                              <ul className="dropdown-menu dropdown-menu-end">
                                <li>
                                  <button type="button" className="dropdown-item" onClick={() => openEdit(e)}>
                                    Edit
                                  </button>
                                </li>
                                <li>
                                  <button
                                    type="button"
                                    className="dropdown-item text-danger"
                                    onClick={() => {
                                      setDeleteError(null);
                                      setDeleteTarget(e);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div className="card-body p-2 pt-0">
                          <div className="text-center mb-3">
                            <div
                              className={`avatar avatar-xxl rounded-4 mx-auto mb-3 ${statusClass} employees-card-avatar`}
                            >
                              {e.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={e.avatarUrl} alt="" />
                              ) : (
                                <span className="employees-card-initials">{employeeInitials(e)}</span>
                              )}
                            </div>
                            <h5 className="mb-0 fw-bold">{name}</h5>
                            <p className="text-primary mb-0">{roleLabel(e.role)}</p>
                          </div>
                          <div className={`p-3 rounded${e.online ? " bg-body" : " bg-light"}`}>
                            <div className="d-flex gap-3">
                              <div className="w-50">
                                <span className="text-1xs">Ville</span>
                                <h6 className="mb-0">{dash(e.ville)}</h6>
                              </div>
                              <div className="w-50">
                                <span className="text-1xs">Créé le</span>
                                <h6 className="mb-0">{e.createdAt ? formatDate(e.createdAt) : "—"}</h6>
                              </div>
                            </div>
                            <hr className="border-dashed" />
                            <div className="d-grid gap-2">
                              <span className="text-truncate" title={e.email}>
                                <i className="fi fi-rr-envelope me-2 text-primary" aria-hidden />
                                {dash(e.email)}
                              </span>
                              <span>
                                <i className="fi fi-rr-phone-call me-2 text-primary" aria-hidden />
                                {dash(e.telephone)}
                              </span>
                              {!e.online && e.lastSeen ? (
                                <span className="text-muted small">
                                  <i className="fi fi-rr-clock me-2" aria-hidden />
                                  Vu {formatDateTime(e.lastSeen)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="row">
                <div className="col-lg-12">
                  <nav aria-label="pagination" className="float-end">
                    <ul className="pagination">
                      <li className={`page-item${currentPage <= 1 ? " disabled" : ""}`}>
                        <button
                          type="button"
                          className="page-link"
                          aria-label="Previous"
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <i className="fi fi-rr-angle-left me-1" aria-hidden />
                          Previous
                        </button>
                      </li>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          const showEllipsis = prev != null && p - prev > 1;
                          return (
                            <span key={p} className="d-contents">
                              {showEllipsis ? (
                                <li className="page-item disabled">
                                  <span className="page-link">…</span>
                                </li>
                              ) : null}
                              <li className={`page-item${p === currentPage ? " active" : ""}`}>
                                <button type="button" className="page-link" onClick={() => setPage(p)}>
                                  {p}
                                </button>
                              </li>
                            </span>
                          );
                        })}
                      <li className={`page-item${currentPage >= totalPages ? " disabled" : ""}`}>
                        <button
                          type="button"
                          className="page-link"
                          aria-label="Next"
                          disabled={currentPage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                          <i className="fi fi-rr-angle-right ms-1" aria-hidden />
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <EmployeeFormModal
        open={formOpen}
        mode={formMode}
        initial={editing}
        submitting={formSubmitting}
        error={formError}
        onClose={() => !formSubmitting && setFormOpen(false)}
        onSubmit={(payload) => void handleFormSubmit(payload)}
      />

      <DeleteEmployeeModal
        open={Boolean(deleteTarget)}
        employeeName={deleteTarget ? employeeFullName(deleteTarget) : ""}
        submitting={deleteSubmitting}
        error={deleteError}
        onClose={() => !deleteSubmitting && setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
