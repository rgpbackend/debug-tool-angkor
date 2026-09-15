import { useCallback, useState } from "react";
import type { GameSymbol } from "../../../ws/protocol";
import { formatCreditAmount } from "../../../lib/session-utils";
import { BULLET_REEL_HEIGHTS } from "../bullet-protocol";

interface BulletSlotMachineProps {
  reels: string[][];
  spinning: boolean;
  symbols: GameSymbol[];
  balance: string | null;
  totalWin: string | null;
  betLevels: string[];
  selectBetValue: string;
  onBetChange: (bet: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  onSpin: () => void;
  onBackToLobby: () => void;
  error: string | null;
}

function symbolLabel(id: string): string {
  return id.trim() ? id : "·";
}

export default function BulletSlotMachine({
  reels,
  spinning,
  symbols,
  balance,
  totalWin,
  betLevels,
  selectBetValue,
  onBetChange,
  betDisabled,
  canSpin,
  onSpin,
  onBackToLobby,
  error,
}: BulletSlotMachineProps) {
  const [betPickerOpen, setBetPickerOpen] = useState(false);

  const stepBet = useCallback(
    (dir: -1 | 1) => {
      const idx = betLevels.indexOf(selectBetValue);
      const next = idx + dir;
      if (next >= 0 && next < betLevels.length) onBetChange(betLevels[next]);
    },
    [betLevels, onBetChange, selectBetValue],
  );

  const betDisplay = `$${Number(selectBetValue).toFixed(2)}`;
  const winNum = totalWin != null ? Number(totalWin) : 0;
  const showWin = Number.isFinite(winNum) && winNum > 0;

  return (
    <div className="bullet-cabinet">
      <header className="bullet-toolbar">
        <button type="button" className="bullet-lobby-btn" onClick={onBackToLobby}>
          ← Lobby
        </button>
        <h1 className="bullet-title">Bullet and Bounty</h1>
        <span className="bullet-ways">576 Ways</span>
      </header>

      <div className="bullet-hud">
        <div className="bullet-hud-item">
          <span className="bullet-hud-label">Balance</span>
          <span className="bullet-hud-value">
            {balance != null ? `$${formatCreditAmount(balance)}` : "—"}
          </span>
        </div>
        <div className="bullet-hud-item">
          <span className="bullet-hud-label">Win</span>
          <span className={`bullet-hud-value${showWin ? " bullet-hud-value--win" : ""}`}>
            {showWin ? `$${formatCreditAmount(totalWin!)}` : "$0.00"}
          </span>
        </div>
      </div>

      <div
        className={`bullet-grid${spinning ? " bullet-grid--spinning" : ""}`}
        role="img"
        aria-label="Bullet and Bounty reels 3-4-4-4-3"
      >
        {BULLET_REEL_HEIGHTS.map((height, col) => (
          <div key={col} className="bullet-reel" data-height={height}>
            {Array.from({ length: height }, (_, row) => {
              const id = reels[col]?.[row] ?? "";
              const kind = symbols.find((s) => s.id === id)?.kind;
              return (
                <div
                  key={`${col}-${row}`}
                  className={`bullet-cell${kind ? ` bullet-cell--${kind.toLowerCase()}` : ""}`}
                >
                  {symbolLabel(id)}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="bullet-ticker">
        {error
          ? error
          : spinning
            ? "Spinning…"
            : "Win up to 576 Ways · 3 Scatters trigger Free Spins · Win cap 13950x"}
      </div>

      <div className="bullet-controls">
        <div className="bullet-bet-controls">
          <button
            type="button"
            className="bullet-bet-btn"
            disabled={betDisabled}
            onClick={() => stepBet(-1)}
          >
            −
          </button>
          <button
            type="button"
            className="bullet-bet-display"
            disabled={betDisabled}
            onClick={() => !betDisabled && setBetPickerOpen(true)}
          >
            {betDisplay}
          </button>
          <button
            type="button"
            className="bullet-bet-btn"
            disabled={betDisabled}
            onClick={() => stepBet(1)}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className={`bullet-spin-btn${spinning ? " bullet-spin-btn--busy" : ""}`}
          disabled={!canSpin && !spinning}
          onClick={() => {
            if (!spinning) onSpin();
          }}
        >
          {spinning ? "■" : "SPIN"}
        </button>
      </div>

      {betPickerOpen ? (
        <div className="bullet-modal-backdrop" onClick={() => setBetPickerOpen(false)}>
          <div className="bullet-bet-picker" onClick={(e) => e.stopPropagation()}>
            <h3>Select Bet</h3>
            <div className="bullet-bet-picker-grid">
              {betLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`bullet-bet-option${level === selectBetValue ? " bullet-bet-option--on" : ""}`}
                  onClick={() => {
                    onBetChange(level);
                    setBetPickerOpen(false);
                  }}
                >
                  ${Number(level).toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
