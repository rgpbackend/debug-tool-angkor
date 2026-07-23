interface BetPickerModalProps {
  open: boolean;
  betLevels: string[];
  currentBet: string;
  onSelect: (bet: string) => void;
  onClose: () => void;
}

export default function BetPickerModal({
  open,
  betLevels,
  currentBet,
  onSelect,
  onClose,
}: BetPickerModalProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bet-picker" onClick={(e) => e.stopPropagation()}>
        <h3 className="bet-picker-title">Select Bet</h3>
        <div className="bet-picker-grid">
          {betLevels.map((level) => (
            <button
              key={level}
              className={`bet-option${level === currentBet ? " bet-selected" : ""}`}
              onClick={() => { onSelect(level); onClose(); }}
            >
              ${Number(level).toFixed(2)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
