import { useCallback, useState } from "react";
import AutospinPicker from "./AutospinPicker";
import BetPickerModal from "./BetPickerModal";

interface TitanControlsProps {
  betLevels: string[];
  selectBetValue: string;
  onBetChange: (bet: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  onSpin: () => void;
  autoSpinActive: boolean;
  autoSpinCount: number | null;
  onAutoSpinStart: (count: number) => void;
  onAutoSpinStop: () => void;
  superBetActive: boolean;
  superBetToggleable: boolean;
  onSuperBetToggle: (active: boolean) => void;
}

export default function TitanControls({
  betLevels,
  selectBetValue,
  onBetChange,
  betDisabled,
  canSpin,
  spinning,
  onSpin,
  autoSpinActive,
  autoSpinCount,
  onAutoSpinStart,
  onAutoSpinStop,
  superBetActive,
  superBetToggleable,
  onSuperBetToggle,
}: TitanControlsProps) {
  const [autoPickerOpen, setAutoPickerOpen] = useState(false);
  const [betPickerOpen, setBetPickerOpen] = useState(false);

  const handleAutoSelect = useCallback((count: number) => {
    onAutoSpinStart(count);
  }, [onAutoSpinStart]);

  const betDisplay = `$${Number(selectBetValue).toFixed(2)}`;

  return (
    <>
      <div className="titan-controls">
        {/* Super Bet Toggle */}
        <button
          className={`titan-super-bet${superBetActive ? " super-bet-on" : ""}`}
          onClick={() => onSuperBetToggle(!superBetActive)}
          disabled={!superBetToggleable}
          title={superBetActive ? "Super Bet: ON" : "Super Bet: OFF"}
        >
          <span className="super-bet-label">SUPER BET</span>
          {superBetActive && <span className="super-bet-badge">DOUBLE WILDS!</span>}
        </button>

        {/* Bet Controls */}
        <div className="titan-bet-controls">
          <button
            className="bet-btn"
            disabled={betDisabled}
            onClick={() => {
              const idx = betLevels.indexOf(selectBetValue);
              if (idx > 0) onBetChange(betLevels[idx - 1]);
            }}
          >
            −
          </button>
          <button className="bet-display" onClick={() => !betDisabled && setBetPickerOpen(true)}>
            {betDisplay}
          </button>
          <button
            className="bet-btn"
            disabled={betDisabled}
            onClick={() => {
              const idx = betLevels.indexOf(selectBetValue);
              if (idx < betLevels.length - 1) onBetChange(betLevels[idx + 1]);
            }}
          >
            +
          </button>
        </div>

        {/* Spin Button */}
        <button
          className={`titan-spin-btn${spinning ? " spin-spinning" : ""}${autoSpinActive ? " spin-auto" : ""}`}
          disabled={!canSpin && !spinning}
          onClick={() => {
            if (autoSpinActive) { onAutoSpinStop(); }
            else if (spinning) { /* stop handled by auto-spin */ }
            else { onSpin(); }
          }}
        >
          {autoSpinActive && autoSpinCount ? (
            <span className="spin-auto-count">{autoSpinCount}</span>
          ) : spinning ? (
            <span className="spin-stop-icon">■</span>
          ) : (
            <span className="spin-icon">⚡</span>
          )}
        </button>

        {/* Auto Spin Button */}
        <button
          className="titan-auto-btn"
          disabled={!canSpin}
          onClick={() => {
            if (autoSpinActive) { onAutoSpinStop(); }
            else { setAutoPickerOpen(true); }
          }}
        >
          {autoSpinActive ? "STOP" : "AUTO"}
        </button>
      </div>

      <AutospinPicker
        open={autoPickerOpen}
        onSelect={handleAutoSelect}
        onClose={() => setAutoPickerOpen(false)}
      />
      <BetPickerModal
        open={betPickerOpen}
        betLevels={betLevels}
        currentBet={selectBetValue}
        onSelect={onBetChange}
        onClose={() => setBetPickerOpen(false)}
      />
    </>
  );
}
