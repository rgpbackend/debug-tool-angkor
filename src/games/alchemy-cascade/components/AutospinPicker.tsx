type AutospinPickerProps = {
  open: boolean;
  onSelect: (count: number) => void;
  onClose: () => void;
};

const OPTIONS = [10, 20, 30, 50, 70, 100, 500, 1000, Infinity];

export default function AutospinPicker({ open, onSelect, onClose }: AutospinPickerProps) {
  if (!open) return null;
  return (
    <div className="alchemy-modal-backdrop" onClick={onClose}>
      <div className="alchemy-picker" onClick={(e) => e.stopPropagation()}>
        <h3 className="alchemy-picker-title">Auto Spin</h3>
        <div className="alchemy-picker-options">
          {OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className="alchemy-picker-option"
              onClick={() => {
                onSelect(n);
                onClose();
              }}
            >
              {n === Infinity ? "∞" : n}
            </button>
          ))}
        </div>
        <button type="button" className="alchemy-lobby-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
