interface MenuPopoverProps {
  open: boolean;
  onOpenPaytable: () => void;
  onOpenHistory: () => void;
  onOpenJackpotWinners: () => void;
  onClose: () => void;
}

export default function MenuPopover({ open, onOpenPaytable, onOpenHistory, onOpenJackpotWinners, onClose }: MenuPopoverProps) {
  if (!open) return null;

  const items: { label: string; icon: string; action: () => void; disabled?: boolean }[] = [
    { label: "Paytable", icon: "📋", action: () => { onOpenPaytable(); onClose(); } },
    { label: "Game Rules", icon: "📖", action: () => {}, disabled: true },
    { label: "Sound", icon: "🔊", action: () => {}, disabled: true },
    { label: "Music", icon: "🎵", action: () => {}, disabled: true },
    { label: "History", icon: "🕐", action: () => { onOpenHistory(); onClose(); } },
    { label: "Jackpot Winners", icon: "🏆", action: () => { onOpenJackpotWinners(); onClose(); } },
  ];

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu-popover" onClick={(e) => e.stopPropagation()}>
        {items.map((item) => (
          <button
            key={item.label}
            className="menu-item"
            onClick={item.action}
            disabled={item.disabled}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
            {item.disabled && <span className="menu-soon">Soon</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
