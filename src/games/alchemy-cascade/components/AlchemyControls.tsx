import { useCallback, useState } from "react";
import { formatAlchemyMoney } from "../lib/format";
import AutospinPicker from "./AutospinPicker";

type AlchemyControlsProps = {
  betLevels: string[];
  selectBetValue: string;
  onBetChange: (bet: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  fastSpin: boolean;
  onFastSpinToggle: () => void;
  onSpin: () => void;
  onBuy: () => void;
  buyCost: string;
  autoSpinActive: boolean;
  autoSpinCount: number | null;
  onAutoSpinStart: (count: number) => void;
  onAutoSpinStop: () => void;
  onOpenMenu: () => void;
};

export default function AlchemyControls({
  betLevels,
  selectBetValue,
  onBetChange,
  betDisabled,
  canSpin,
  spinning,
  fastSpin,
  onFastSpinToggle,
  onSpin,
  onBuy,
  buyCost,
  autoSpinActive,
  autoSpinCount,
  onAutoSpinStart,
  onAutoSpinStop,
  onOpenMenu,
}: AlchemyControlsProps) {
  const [autoPickerOpen, setAutoPickerOpen] = useState(false);

  const stepBet = useCallback(
    (dir: -1 | 1) => {
      const idx = betLevels.indexOf(selectBetValue);
      const next = idx + dir;
      if (next >= 0 && next < betLevels.length) {
        onBetChange(betLevels[next]);
      }
    },
    [betLevels, onBetChange, selectBetValue],
  );

  const betDisplay = formatAlchemyMoney(selectBetValue);

  return (
    <>
      <div className="alchemy-controls">
        <button type="button" className="alchemy-ctrl-btn" onClick={onOpenMenu} title="Menu">
          Menu
        </button>
        <button
          type="button"
          className={`alchemy-ctrl-btn${fastSpin ? " alchemy-ctrl-btn--on" : ""}`}
          onClick={onFastSpinToggle}
          title={fastSpin ? "Fast Spin: ON" : "Fast Spin: OFF"}
        >
          {fastSpin ? "⚡" : <span className="alchemy-fast-off">⚡</span>}
        </button>
        <div className="alchemy-bet-controls">
          <button type="button" className="alchemy-ctrl-btn" disabled={betDisabled} onClick={() => stepBet(-1)}>
            −
          </button>
          <span className="alchemy-bet-display">{betDisplay}</span>
          <button type="button" className="alchemy-ctrl-btn" disabled={betDisabled} onClick={() => stepBet(1)}>
            +
          </button>
        </div>
        <button
          type="button"
          className="alchemy-buy-btn"
          disabled={!canSpin}
          title={`Debit ${buyCost} and start Gold Fever`}
          onClick={onBuy}
        >
          Buy {buyCost}
        </button>
        <button
          type="button"
          className={`alchemy-spin-btn${spinning ? " alchemy-spin-btn--busy" : ""}${autoSpinActive ? " alchemy-spin-btn--auto" : ""}`}
          disabled={!canSpin && !spinning && !autoSpinActive}
          onClick={() => {
            if (autoSpinActive) {
              onAutoSpinStop();
              return;
            }
            if (!spinning) {
              onSpin();
            }
          }}
        >
          {autoSpinActive && autoSpinCount != null ? (
            <span>{autoSpinCount === Infinity ? "∞" : autoSpinCount}</span>
          ) : spinning ? (
            <span>■</span>
          ) : (
            <span className="alchemy-spin-idle">↻</span>
          )}
        </button>
        <button
          type="button"
          className="alchemy-ctrl-btn"
          disabled={!canSpin && !autoSpinActive}
          onClick={() => {
            if (autoSpinActive) {
              onAutoSpinStop();
            } else {
              setAutoPickerOpen(true);
            }
          }}
        >
          {autoSpinActive ? "Stop" : "Auto"}
        </button>
      </div>
      <AutospinPicker
        open={autoPickerOpen}
        onSelect={onAutoSpinStart}
        onClose={() => setAutoPickerOpen(false)}
      />
    </>
  );
}
