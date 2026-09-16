import { useEffect, useMemo, useState } from "react";
import { useBulletSession } from "./useBulletSession";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import BulletSlotMachine from "./components/BulletSlotMachine";
import WsConsole from "./components/WsConsole";
import "./slot-machine.css";

const MODE_LABELS: Record<string, string> = {
  FREE_SPIN_GUNSLINGER: "Gunslinger spins",
  FREE_SPIN_HUNTER: "Hunter spins",
  SHOOTOUT_GUNSLINGER: "Shootout Gunslinger",
  SHOOTOUT_HUNTER: "Shootout Hunter",
};

function joiningCopy(joinRetryOpen: boolean, phase: string): string {
  if (joinRetryOpen) return "Join failed";
  if (phase === "connecting") return "Connecting…";
  if (phase === "connected") return "Connected. Joining…";
  if (phase === "joining") return "Joining…";
  return "Opening the wire…";
}

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
    winSymbols,
    steps,
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
    clientRef,
    phase,
  } = session;

  useEffect(() => {
    if (session.gameScreenActive && !session.sessionReady) {
      void joinGame();
    }
  }, [session.gameScreenActive, session.sessionReady, joinGame]);

  const displayBalance = wsBalance ?? parentBalance ?? null;
  const [choosing, setChoosing] = useState(false);

  return (
    <div className="bullet-screen">
      <div className="bullet-game-col">
        {freeSpin && freeSpin.spinsLeft > 0 && !pendingChoice ? (
          <div className="bullet-fs-badge" role="status">
            {freeSpin.mode ? `${MODE_LABELS[freeSpin.mode] ?? freeSpin.mode}, ` : ""}
            {freeSpin.spinsLeft} left
            {freeSpin.multiplier > 1 ? ` ×${freeSpin.multiplier}` : ""}
          </div>
        ) : null}

        {sessionReady ? (
          <BulletSlotMachine
            reels={reels}
            spinning={isSpinning}
            winSymbols={winSymbols}
            steps={steps}
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
        ) : (
          <div className="bullet-joining-card">
            <p className="bullet-joining-mark">Bullet and Bounty</p>
            <div className="bullet-joining-bar-track">
              <div className="bullet-joining-bar" />
            </div>
            <p className="bullet-joining-status" role="status">
              {joiningCopy(joinRetryOpen, phase)}
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
                    Lobby
                  </button>
                </div>
              </div>
            ) : (
              <div className="bullet-joining-actions">
                <button type="button" className="bullet-lobby-btn" onClick={onBackToLobby}>
                  Lobby
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <WsConsole clientRef={clientRef} phase={phase} />

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
            <h2>Free spins</h2>
            <p>Pick a mode. The round keeps this bet.</p>
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

      {sessionTakenOver ? (
        <div className="bullet-modal-backdrop">
          <div className="bullet-popup">
            <h2>Session taken over</h2>
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
