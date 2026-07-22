import { useState } from "react";
import SuperBetToggle from "./SuperBetToggle";
import AutoSpinPicker from "./AutoSpinPicker";

type TitanControlsProps = {
  betValue: string;
  betLevels: string[];
  onBetChange: (v: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  onSpin: () => void;
  autoSpinCount: number | null;
  onAutoSpinChange: (count: number | null) => void;
  fastSpin: boolean;
  onFastSpinToggle: () => void;
  superBet: boolean;
  onSuperBetToggle: () => void;
  balance: string | null;
  connected: boolean;
};

export default function TitanControls({
  betValue, betLevels, onBetChange, betDisabled, canSpin, spinning, onSpin,
  autoSpinCount, onAutoSpinChange, fastSpin, onFastSpinToggle,
  superBet, onSuperBetToggle, balance, connected,
}: TitanControlsProps) {
  const [autoPickerOpen, setAutoPickerOpen] = useState(false);
  const betIndex = betLevels.indexOf(betValue);

  const decBet = () => { if (betIndex > 0) onBetChange(betLevels[betIndex - 1]); };
  const incBet = () => { if (betIndex < betLevels.length - 1) onBetChange(betLevels[betIndex + 1]); };

  return (
    <div className="titan-controls" role="group" aria-label="Game controls">
      <div className="titan-balance">
        <span className="titan-balance-label">Balance</span>
        <span className="titan-balance-value">
          {!connected || balance == null ? "—" : formatTitanBalance(balance)}
        </span>
      </div>

      <div className="titan-bet-cluster">
        <button onClick={decBet} disabled={betDisabled || betIndex <= 0} aria-label="Decrease bet">◀</button>
        <span className="titan-bet-value">${betValue}</span>
        <button onClick={incBet} disabled={betDisabled || betIndex >= betLevels.length - 1} aria-label="Increase bet">▶</button>
      </div>

      <SuperBetToggle active={superBet} onToggle={onSuperBetToggle} disabled={betDisabled} />

      <button className={`titan-fast-btn${fastSpin ? " titan-fast-btn--on" : ""}`} onClick={onFastSpinToggle} disabled={spinning} title="Fast Spin">⚡</button>

      <button className="titan-auto-btn" onClick={() => setAutoPickerOpen(true)} disabled={spinning || !canSpin}>
        {autoSpinCount != null ? autoSpinCount : "Auto"}
      </button>
      {autoPickerOpen && (
        <AutoSpinPicker
          onSelect={(c) => { onAutoSpinChange(c); setAutoPickerOpen(false); }}
          onCancel={() => setAutoPickerOpen(false)}
        />
      )}

      <button className="titan-spin-btn" onClick={onSpin} disabled={!canSpin || spinning}>
        {spinning ? "…" : autoSpinCount != null ? `◼ ${autoSpinCount}` : "⟳ Spin"}
      </button>
    </div>
  );
}

function formatTitanBalance(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const [intPart] = value.split(".");
  return (intPart ?? "0").padStart(7, "0") + ".00";
}
