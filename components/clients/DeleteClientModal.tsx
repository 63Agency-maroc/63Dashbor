"use client";

type Props = {
  open: boolean;
  clientName: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteClientModal({ open, clientName, submitting, error, onClose, onConfirm }: Props) {
  if (!open) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Delete Customer</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={submitting} />
            </div>
            <div className="modal-body">
              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}
              <p className="mb-0">
                Supprimer le client <strong>{clientName || "—"}</strong> ? Cette action est irréversible.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger ms-2" onClick={onConfirm} disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  "Delete"
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
