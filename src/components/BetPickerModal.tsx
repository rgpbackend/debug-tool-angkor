import { useEffect } from "react";
import { formatBet } from "../lib/format-bet";

export type BetPickerModalProps = {
  open: boolean;
  betValue: string;
  betLevels: string[];
  disabled: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
};

export default function BetPickerModal({
  open,
  betValue,
  betLevels,
  disabled,
  onClose,
  onSelect,
}: Readonly<BetPickerModalProps>) {
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

  const handleSelect = (level: string) => {
    if (disabled) {
      return;
    }
    onSelect(level);
    onClose();
  };

  return (
    <div className="cheat-modal-root bet-picker-modal-root" role="presentation">
      <button
        type="button"
        className="cheat-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="cheat-modal panel bet-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bet-picker-modal-title"
      >
        <header className="cheat-modal-header">
          <h2 id="bet-picker-modal-title">Chọn mức cược</h2>
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
          Mức cược hiện tại: <strong>{formatBet(betValue)}</strong>
        </p>

        <div className="bet-picker-grid" role="listbox" aria-label="Bet amount">
          {betLevels.map((level) => {
            const selected = level === betValue;
            return (
              <button
                key={level}
                type="button"
                role="option"
                aria-selected={selected}
                className={`bet-picker-option${selected ? " bet-picker-option--selected" : ""}`}
                disabled={disabled}
                onClick={() => handleSelect(level)}
              >
                {formatBet(level)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
