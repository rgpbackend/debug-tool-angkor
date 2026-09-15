import { useEffect, useMemo, useState } from "react";
import { useBulletSession } from "./useBulletSession";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import BulletSlotMachine from "./components/BulletSlotMachine";
import "./slot-machine.css";

const MODE_LABELS: Record<string, string> = {
  FREE_SPIN_GUNSLINGER: "Gunslinger Spins",
  FREE_SPIN_HUNTER: "Hunter Spins",
  SHOOTOUT_GUNSLINGER: "Shootout Gunslinger Spins",
  SHOOTOUT_HUNTER: "Shootout Hunter Spins",
};

export default function GameScreen({
  wsAccessToken,
  balance: parentBalance,
  onBackToLobby,
  onLogout,
}: GameScreenProps) {
  const defaults = useMemo(() => readEnvDefaults(), []);

  const session = useBulletSession(
    defaults.wsUrl,
    wsAccessToken,
    { onTokenBan: onLogout, onConnectionLost: onBackToLobby },
    parentBalance,
  );

  const {
    sessionReady,
    joinGame,
    error,
    setGameError,
    betLevels,
    balance: wsBalance,
    bet,
    setBet,
    spin,
    canSpin,
    isSpinning,
    reels,
    totalWin,
    symbolCatalog,
    freeSpin,
    pendingChoice,
    selectFreeSpinMode,
    sessionTakenOver,
    dismissSessionTakenOver,
    joinRetryOpen,
    joinRetryMessage,
    joinRetryBusy,
    retryJoinGame,
    dismissJoinRetry,
  } = session;

  useEffect(() => {
    if (session.gameScreenActive && !session.sessionReady) {
      void joinGame();
    }
  }, [session.gameScreenActive, session.sessionReady, joinGame]);

  const displayBalance = wsBalance ?? parentBalance ?? null;
  const [choosing, setChoosing] = useState(false);

  if (!sessionReady) {
    return (
      <div className="bullet-screen bullet-screen--joining">
        <div className="bullet-joining-card">
          <div className="bullet-joining-emblem">🤠</div>
          <h1 className="bullet-joining-title">Bullet and Bounty</h1>
          <div className="bullet-joining-bar-track">
            <div className="bullet-joining-bar" />
          </div>
          <p className="bullet-joining-status" role="status">
            {joinRetryOpen ? "Join failed" : "Connecting…"}
          </p>
          {joinRetryOpen ? (
            <div className="bullet-join-retry">
              {joinRetryMessage ? <p className="bullet-error-text">{joinRetryMessage}</p> : null}
              <div className="bullet-joining-actions">
                <button
                  type="button"
                  className="bullet-lobby-btn"
                  disabled={joinRetryBusy}
                  onClick={() => retryJoinGame()}
                >
                  {joinRetryBusy ? "Joining…" : "Retry join"}
                </button>
                <button type="button" className="bullet-lobby-btn" onClick={dismissJoinRetry}>
                  ← Lobby
                </button>
              </div>
            </div>
          ) : (
            <div className="bullet-joining-actions">
              <button type="button" className="bullet-lobby-btn" onClick={onBackToLobby}>
                ← Lobby
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bullet-screen">
      <BulletSlotMachine
        reels={reels}
        spinning={isSpinning}
        symbols={symbolCatalog}
        balance={displayBalance}
        totalWin={totalWin}
        betLevels={betLevels}
        selectBetValue={bet}
        onBetChange={setBet}
        betDisabled={isSpinning || !sessionReady}
        canSpin={canSpin && !isSpinning}
        onSpin={() => void spin()}
        onBackToLobby={onBackToLobby}
        error={error}
      />

      {error && sessionReady ? (
        <div className="bullet-modal-backdrop" onClick={() => setGameError(null)}>
          <div className="bullet-popup" onClick={(e) => e.stopPropagation()}>
            <h2>Error</h2>
            <p>{error}</p>
            <button type="button" className="bullet-lobby-btn" onClick={() => setGameError(null)}>
              OK
            </button>
          </div>
        </div>
      ) : null}

      {pendingChoice ? (
        <div className="bullet-modal-backdrop">
          <div className="bullet-popup">
            <h2>Free Spins</h2>
            <p>Choose your free spins mode:</p>
            <div className="bullet-joining-actions">
              {pendingChoice.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="bullet-lobby-btn"
                  disabled={choosing}
                  onClick={() => {
                    setChoosing(true);
                    void selectFreeSpinMode(mode).finally(() => setChoosing(false));
                  }}
                >
                  {MODE_LABELS[mode] ?? mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {freeSpin && freeSpin.spinsLeft > 0 && !pendingChoice ? (
        <div className="bullet-fs-badge" role="status">
          {freeSpin.mode ? `${MODE_LABELS[freeSpin.mode] ?? freeSpin.mode} · ` : ""}
          Spins left: {freeSpin.spinsLeft}
        </div>
      ) : null}

      {sessionTakenOver ? (
        <div className="bullet-modal-backdrop">
          <div className="bullet-popup">
            <h2>Session Taken Over</h2>
            <p>This session was opened on another device. You will be returned to the lobby.</p>
            <button type="button" className="bullet-lobby-btn" onClick={dismissSessionTakenOver}>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
