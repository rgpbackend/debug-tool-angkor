import type { ComboLevel } from "../lib/paylines";

type ComboOverlayProps = { level: ComboLevel; visible: boolean };

const LABELS: Record<Exclude<ComboLevel, "none">, string> = {
  combo: "COMBO!",
  super: "SUPER COMBO!",
  mega: "MEGA COMBO!",
};

export default function ComboOverlay({ level, visible }: ComboOverlayProps) {
  if (!visible || level === "none") return null;

  return (
    <div className={`titan-combo-overlay titan-combo--${level}`} aria-live="polite">
      <span className="titan-combo-text">{LABELS[level]}</span>
    </div>
  );
}
