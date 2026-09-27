"use client";

type Props = {
  open: boolean;
  employeeName: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteEmployeeModal({
  open,
  employeeName,
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content employees-modal">
            <div className="modal-header border-0">
              <h5 className="modal-title">Supprimer l’employé</h5>
              <button type="button" className="btn-close" aria-label="Fermer" onClick={onClose} disabled={submitting} />
            </div>
            <div className="modal-body">
              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}
              <p className="mb-0">
                Supprimer <strong>{employeeName || "—"}</strong> ? Cette action est irréversible.
              </p>
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-light" onClick={onClose} disabled={submitting}>
                Annuler
              </button>
              <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                    Suppression…
                  </>
                ) : (
                  "Supprimer"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}
