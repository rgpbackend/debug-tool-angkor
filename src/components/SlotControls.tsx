type SlotControlsProps = {
  betValue: string;
  betLevels: string[];
  onBetChange: (value: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  onSpin: () => void;
};

export default function SlotControls({
  betValue,
  betLevels,
  onBetChange,
  betDisabled,
  canSpin,
  spinning,
  onSpin,
}: Readonly<SlotControlsProps>) {
  const currentIndex = betLevels.findIndex((level) => level === betValue);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  const stepBet = (delta: number) => {
    const next = safeIndex + delta;
    if (next < 0 || next >= betLevels.length) {
      return;
    }
    onBetChange(betLevels[next] ?? betValue);
  };

  return (
    <div
      className="slot-controls slot-controls--console"
      role="group"
      aria-label="Bet and spin"
    >
      <div className="slot-play-cluster">
        <div className="slot-bet-cluster">
          <div className="slot-bet-stepper">
          <button
            type="button"
            className="slot-bet-step"
            onClick={() => stepBet(-1)}
            disabled={betDisabled || safeIndex <= 0}
            aria-label="Decrease bet"
          >
            −
          </button>
          <select
            className="slot-bet-select"
            value={betValue}
            onChange={(e) => onBetChange(e.target.value)}
            disabled={betDisabled || betLevels.length === 0}
            aria-label="Bet amount"
          >
            {betLevels.map((level) => (
              <option key={level} value={level}>
                {formatBet(level)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="slot-bet-step"
            onClick={() => stepBet(1)}
            disabled={
              betDisabled || safeIndex >= betLevels.length - 1
            }
            aria-label="Increase bet"
          >
            +
          </button>
          </div>
        </div>

        <button
          type="button"
          className="slot-spin-btn"
          onClick={onSpin}
          disabled={!canSpin}
        >
          {spinning ? "Spinning…" : "Spin"}
        </button>
      </div>
    </div>
  );
}

function formatBet(level: string): string {
  const n = Number(level);
  if (!Number.isFinite(n)) {
    return level;
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}
