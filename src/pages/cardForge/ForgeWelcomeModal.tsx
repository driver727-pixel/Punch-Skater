import { ForgeStartHere } from "../../components/ForgeStartHere";

interface ForgeWelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ForgeWelcomeModal({ open, onClose }: ForgeWelcomeModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay forge-welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forge-welcome-title"
      onClick={onClose}
    >
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="close-btn modal-close"
          aria-label="Close welcome"
          onClick={onClose}
        >
          ✕
        </button>
        <ForgeStartHere
          titleId="forge-welcome-title"
          actions={(
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
            >
              Got it — let's forge
            </button>
          )}
        />
      </div>
    </div>
  );
}
