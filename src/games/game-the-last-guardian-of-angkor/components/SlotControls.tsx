import { useState } from "react";
import { formatBet } from "../../../lib/format-bet";
import BetPickerModal from "./BetPickerModal";

type SlotControlsProps = {
  betValue: string;
  betLevels: string[];
  onBetChange: (value: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  onSpin: () => void;
  onManualSpin: () => void;
};

export default function SlotControls({
  betValue,
  betLevels,
  onBetChange,
  betDisabled,
  canSpin,
  spinning,
  onSpin,
  onManualSpin,
}: Readonly<SlotControlsProps>) {
  const [betModalOpen, setBetModalOpen] = useState(false);
  const hasBetLevels = betLevels.length > 0;

  return (
    <>
      <div
        className="slot-controls slot-controls--console"
        role="group"
        aria-label="Bet and spin"
      >
        <div className="slot-play-cluster">
          <div className="slot-bet-cluster">
            <button
              type="button"
              className="slot-bet-trigger"
              onClick={() => setBetModalOpen(true)}
              disabled={betDisabled || !hasBetLevels}
              aria-haspopup="dialog"
              aria-expanded={betModalOpen}
              aria-label={`Bet amount: ${formatBet(betValue)}`}
            >
              <span className="slot-bet-trigger-label">Bet</span>
              <span className="slot-bet-trigger-value">
                {hasBetLevels ? formatBet(betValue) : "—"}
              </span>
            </button>
          </div>

          <button
            type="button"
            className="slot-spin-btn"
            onClick={onSpin}
            disabled={!canSpin}
          >
            {spinning ? "Spinning…" : "Spin"}
          </button>

          <button
            type="button"
            className="slot-console-chip-btn slot-manual-spin-btn"
            onClick={onManualSpin}
            disabled={!canSpin}
          >
            {spinning ? "Spinning…" : "Manual"}
          </button>
        </div>
      </div>

      <BetPickerModal
        open={betModalOpen}
        betValue={betValue}
        betLevels={betLevels}
        disabled={betDisabled}
        onClose={() => setBetModalOpen(false)}
        onSelect={onBetChange}
      />
    </>
  );
}
