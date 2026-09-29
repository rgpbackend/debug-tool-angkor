import { useEffect } from "react";
import JackpotWinnersView from "./JackpotWinnersView";
import type { JackpotWinnersViewProps } from "./JackpotWinnersView";

export type JackpotWinnersModalProps = {
  open: boolean;
  onClose: () => void;
} & Pick<JackpotWinnersViewProps, "canQuery" | "onFetch" | "refreshToken">;

export default function JackpotWinnersModal({
  open,
  canQuery,
  onFetch,
  refreshToken,
  onClose,
}: Readonly<JackpotWinnersModalProps>) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="cheat-modal-root jackpot-winners-modal-root"
      role="presentation"
    >
      <button
        type="button"
        className="cheat-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="cheat-modal panel jackpot-winners-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jackpot-winners-modal-title"
      >
        <header className="cheat-modal-header">
          <h2 id="jackpot-winners-modal-title">Top jackpot winners</h2>
          <button
            type="button"
            className="cheat-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="jackpot-winners-modal-body">
          <JackpotWinnersView
            canQuery={canQuery}
            onFetch={onFetch}
            refreshToken={refreshToken}
          />
        </div>
      </div>
    </div>
  );
}
