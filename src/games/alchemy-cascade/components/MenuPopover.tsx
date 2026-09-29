type MenuPopoverProps = {
  open: boolean;
  soundOn: boolean;
  musicOn: boolean;
  onOpenPaytable: () => void;
  onOpenRules: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onClose: () => void;
};

export default function MenuPopover({
  open,
  soundOn,
  musicOn,
  onOpenPaytable,
  onOpenRules,
  onToggleSound,
  onToggleMusic,
  onClose,
}: MenuPopoverProps) {
  if (!open) return null;

  const items: { label: string; action: () => void; extra?: string; disabled?: boolean }[] = [
    {
      label: "Paytable",
      action: () => {
        onOpenPaytable();
        onClose();
      },
    },
    {
      label: "Game Rule",
      action: () => {
        onOpenRules();
        onClose();
      },
    },
    {
      label: "Sound",
      extra: soundOn ? "On" : "Off",
      action: onToggleSound,
    },
    {
      label: "Music",
      extra: musicOn ? "On" : "Off",
      action: onToggleMusic,
    },
    { label: "History", action: () => {}, disabled: true, extra: "Not available" },
  ];

  return (
    <div className="alchemy-modal-backdrop" onClick={onClose}>
      <div className="alchemy-menu" onClick={(e) => e.stopPropagation()}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="alchemy-menu-item"
            onClick={item.action}
            disabled={item.disabled}
          >
            <span>{item.label}</span>
            {item.extra ? <span className="alchemy-menu-extra">{item.extra}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
