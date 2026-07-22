const PRESETS = [5, 10, 25, 50, 100, Infinity] as const;

type AutoSpinPickerProps = { onSelect: (count: number | null) => void; onCancel: () => void };

export default function AutoSpinPicker({ onSelect, onCancel }: AutoSpinPickerProps) {
  return (
    <div className="titan-autospin-picker" role="dialog" aria-label="Auto-spin presets">
      {PRESETS.map((n) => (
        <button key={n} className="titan-autospin-option" onClick={() => onSelect(Number.isFinite(n) ? n : null)}>
          {Number.isFinite(n) ? String(n) : "∞"}
        </button>
      ))}
      <button className="titan-autospin-cancel" onClick={onCancel}>Cancel</button>
    </div>
  );
}
