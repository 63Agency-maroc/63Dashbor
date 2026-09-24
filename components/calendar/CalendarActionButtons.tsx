"use client";

type Props = {
  canManageBlocked: boolean;
  /** Admin only — dispos */
  canManageAvailabilities?: boolean;
  onAddMeeting: () => void;
  onBlockDate: () => void;
  onAvailabilities?: () => void;
  className?: string;
};

/** Boutons d’action Calendar — réutilisés en tête de page et au-dessus du tableau. */
export function CalendarActionButtons({
  canManageBlocked,
  canManageAvailabilities = false,
  onAddMeeting,
  onBlockDate,
  onAvailabilities,
  className,
}: Props) {
  return (
    <div className={`d-flex flex-wrap align-items-center gap-2 ${className ?? ""}`}>
      <button type="button" className="btn btn-primary waves-effect waves-light" onClick={onAddMeeting}>
        <i className="fi fi-rr-plus me-1" /> Ajouter un meeting
      </button>
      {canManageBlocked ? (
        <button type="button" className="btn btn-outline-secondary waves-effect waves-light" onClick={onBlockDate}>
          <i className="fi fi-rr-ban me-1" /> Bloquer une date
        </button>
      ) : null}
      {canManageAvailabilities && onAvailabilities ? (
        <button
          type="button"
          className="btn btn-outline-primary waves-effect waves-light"
          onClick={onAvailabilities}
        >
          <i className="fi fi-rr-clock me-1" /> Disponibilités
        </button>
      ) : null}
    </div>
  );
}
