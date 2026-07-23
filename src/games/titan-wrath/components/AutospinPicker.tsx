interface AutospinPickerProps {
  open: boolean;
  onSelect: (count: number) => void;
  onClose: () => void;
}

const OPTIONS = [5, 10, 25, 50, 100, Infinity];

export default function AutospinPicker({ open, onSelect, onClose }: AutospinPickerProps) {
  if (!open) return null;
  return (
    <div className="autospin-backdrop" onClick={onClose}>
      <div className="autospin-picker" onClick={(e) => e.stopPropagation()}>
        <h3 className="autospin-title">Auto Spin</h3>
        <div className="autospin-options">
          {OPTIONS.map((n) => (
            <button
              key={n}
              className="autospin-option"
              onClick={() => { onSelect(n); onClose(); }}
            >
              {n === Infinity ? "∞" : n}
            </button>
          ))}
        </div>
        <button className="autospin-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
