"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmModal({ open, onClose, onConfirm }: Props) {
  if (!open) return null;

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: "block", zIndex: 1060 }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logoutConfirmTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow" style={{ borderRadius: "1.1rem" }}>
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title" id="logoutConfirmTitle">
                Se déconnecter ?
              </h5>
              <button type="button" className="btn-close" aria-label="Fermer" onClick={onClose} />
            </div>
            <div className="modal-body pt-2">
              <p className="text-muted mb-0">
                Vous allez quitter votre session. Vous pourrez vous reconnecter à tout moment.
              </p>
            </div>
            <div className="modal-footer border-0 pt-0">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Annuler
              </button>
              <button type="button" className="btn btn-danger" onClick={onConfirm}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1055 }}
        onClick={onClose}
      />
    </>
  );
}
