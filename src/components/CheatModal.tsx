import { useEffect } from "react";
import CheatReelGridEditor from "./CheatReelGridEditor";

export type CheatModalProps = {
  open: boolean;
  onClose: () => void;
  cheatGrid: string[][];
  canCheat: boolean;
  cheatStatus: string | null;
  cheatSymbolOptions: readonly string[];
  onCellChange: (
    reelIndex: number,
    rowIndex: number,
    colLen: number,
    value: string,
  ) => void;
  onSetCheat: () => void;
  onForceJackpot: () => void;
};

export default function CheatModal({
  open,
  onClose,
  cheatGrid,
  canCheat,
  cheatStatus,
  cheatSymbolOptions,
  onCellChange,
  onSetCheat,
  onForceJackpot,
}: Readonly<CheatModalProps>) {
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
    <div className="cheat-modal-root" role="presentation">
      <button
        type="button"
        className="cheat-modal-backdrop"
        aria-label="Close cheat panel"
        onClick={onClose}
      />
      <div
        className="cheat-modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cheat-modal-title"
      >
        <header className="cheat-modal-header">
          <h2 id="cheat-modal-title">Cheat tools</h2>
          <button
            type="button"
            className="cheat-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="cheat-hint muted">
          Shape <code>[3,4,4,4,3]</code> — one symbol per cell (
          {cheatSymbolOptions.join(", ")}).
        </p>

        <CheatReelGridEditor
          cheatGrid={cheatGrid}
          canCheat={canCheat}
          onCellChange={onCellChange}
        />

        <div className="row cheat-modal-actions">
          <button
            type="button"
            className="primary"
            onClick={onSetCheat}
            disabled={!canCheat}
          >
            Set cheat (2001)
          </button>
          <button
            type="button"
            className="primary"
            onClick={onForceJackpot}
            disabled={!canCheat}
          >
            Force jackpot (2002)
          </button>
        </div>

        {cheatStatus ? (
          <p className="phase muted cheat-modal-status">{cheatStatus}</p>
        ) : null}
      </div>
    </div>
  );
}
