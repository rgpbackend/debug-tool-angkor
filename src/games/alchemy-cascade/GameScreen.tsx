import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatAlchemyMoney } from "./lib/format";
import { useAlchemySession } from "./useAlchemySession";
import { useAlchemyTumble } from "./hooks/useAlchemyTumble";
import { useAutoSpin } from "./hooks/useAutoSpin";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import AlchemyCabinet from "./components/AlchemyCabinet";
import PayloadInspector from "./components/PayloadInspector";
import "./slot-machine.css";

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
  const [fastSpin, setFastSpin] = useState(false);
  const [autoSpinActive, setAutoSpinActive] = useState(false);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState<number | null>(null);

  const session = useAlchemySession(
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
    symbolCatalog,
    balance: wsBalance,
    bet,
    setBet,
    spin,
    canSpin,
    isSpinning,
    lastSpin,
    steps,
    viewIndex,
    setViewIndex,
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

  const {
    displayGrid,
    ticker,
    isPlaying,
    playIntro,
    playEval,
    showIdle,
    clearTicker,
    cancel,
    finish,
  } = useAlchemyTumble(fastSpin);

  useEffect(() => {
    if (session.gameScreenActive && !session.sessionReady) {
      void joinGame();
    }
  }, [session.gameScreenActive, session.sessionReady, joinGame]);

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !lastSpin || isSpinning) return;
    seededRef.current = true;
    showIdle(lastSpin);
  }, [lastSpin, isSpinning, showIdle]);

  const executeSpin = useCallback(async (buyFeature = false) => {
    if (isSpinning) return;
    clearTicker();
    const result = await spin(
      {
        onBase: (step) => playIntro(step),
        onEval: (evalStep, after) => playEval(evalStep, after),
      },
      buyFeature,
    );
    finish(result);
    if (result && autoSpinActive) {
      if (autoSpinRemaining === Infinity) {
        /* keep running */
      } else if (autoSpinRemaining == null || autoSpinRemaining <= 1) {
        setAutoSpinActive(false);
        setAutoSpinRemaining(null);
      } else {
        setAutoSpinRemaining(autoSpinRemaining - 1);
      }
    } else if (!result) {
      cancel();
      setAutoSpinActive(false);
      setAutoSpinRemaining(null);
    }
  }, [
    isSpinning,
    spin,
    clearTicker,
    playIntro,
    playEval,
    finish,
    cancel,
    autoSpinActive,
    autoSpinRemaining,
  ]);

  const startAutoSpin = useCallback((count: number) => {
    setAutoSpinActive(true);
    setAutoSpinRemaining(count);
  }, []);

  const stopAutoSpin = useCallback(() => {
    setAutoSpinActive(false);
    setAutoSpinRemaining(null);
  }, []);

  const roundIdle = !isSpinning;
  useAutoSpin({
    active: autoSpinActive && sessionReady,
    roundIdle,
    canStartRound: canSpin && !isSpinning,
    onRunRound: () => void executeSpin(),
  });

  const displayBalance = wsBalance ?? parentBalance ?? null;
  const spinning = isSpinning || isPlaying;
  const viewed = steps[viewIndex] ?? lastSpin;
  const infoMode = spinning ? "spinning" : lastSpin && Number(lastSpin.totalWin) > 0 ? "win" : "idle";

  return (
    <div className="alchemy-screen">
      <div className="alchemy-game-col">
        {sessionReady ? (
          <AlchemyCabinet
            cells={displayGrid}
            ticker={ticker}
            infoMode={infoMode}
            totalWin={lastSpin?.totalWin ?? null}
            winCapped={lastSpin?.winCapped === true}
            fever={viewed?.fever ?? null}
            goldenMultiplier={viewed?.goldenMultiplier ?? null}
            balance={displayBalance}
            toolbarSlot={
              <button type="button" className="alchemy-lobby-btn" onClick={onBackToLobby}>
                Lobby
              </button>
            }
            symbols={symbolCatalog}
            betLevels={betLevels}
            selectBetValue={bet}
            onBetChange={setBet}
            betDisabled={spinning || !sessionReady || betLevels.length === 0}
            canSpin={canSpin && !autoSpinActive}
            spinning={spinning}
            fastSpin={fastSpin}
            onFastSpinToggle={() => setFastSpin((v) => !v)}
            onSpin={() => void executeSpin(false)}
            onBuy={() => void executeSpin(true)}
            buyCost={formatAlchemyMoney(String(Number(bet || "0") * 100))}
            autoSpinActive={autoSpinActive}
            autoSpinCount={autoSpinRemaining}
            onAutoSpinStart={startAutoSpin}
            onAutoSpinStop={stopAutoSpin}
          />
        ) : (
          <div className="alchemy-joining-card">
            <p className="alchemy-joining-mark">Alchemy Cascade</p>
            <div className="alchemy-joining-bar-track">
              <div className="alchemy-joining-bar" />
            </div>
            <p className="alchemy-joining-status" role="status">
              {joiningCopy(joinRetryOpen, phase)}
            </p>
            {joinRetryOpen ? (
              <div className="alchemy-join-retry">
                {joinRetryMessage ? <p className="alchemy-error-text">{joinRetryMessage}</p> : null}
                <div className="alchemy-joining-actions">
                  <button
                    type="button"
                    className="alchemy-lobby-btn"
                    disabled={joinRetryBusy}
                    onClick={() => retryJoinGame()}
                  >
                    {joinRetryBusy ? "Joining…" : "Retry join"}
                  </button>
                  <button type="button" className="alchemy-lobby-btn" onClick={dismissJoinRetry}>
                    Lobby
                  </button>
                </div>
              </div>
            ) : (
              <div className="alchemy-joining-actions">
                <button type="button" className="alchemy-lobby-btn" onClick={onBackToLobby}>
                  Lobby
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <PayloadInspector
        clientRef={clientRef}
        phase={phase}
        headerExtra={
          steps.length > 1 ? (
            <div className="alchemy-steps" role="tablist" aria-label="Cascade steps">
              {steps.map((step, i) => (
                <button
                  key={`${step.roundId}-${step.spinIndex}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === viewIndex}
                  className={`alchemy-step${i === viewIndex ? " alchemy-step--on" : ""}`}
                  onClick={() => {
                    setViewIndex(i);
                    if (!spinning) showIdle(step);
                  }}
                >
                  {step.spinType || `Step ${step.spinIndex}`}
                  {step.spinType === "CASCADE" ? ` ${step.spinIndex}` : ""}
                </button>
              ))}
            </div>
          ) : null
        }
      />

      {error && sessionReady ? (
        <div className="alchemy-modal-backdrop" onClick={() => setGameError(null)}>
          <div className="alchemy-popup" onClick={(e) => e.stopPropagation()}>
            <h2>Error</h2>
            <p>{error}</p>
            <button type="button" className="alchemy-lobby-btn" onClick={() => setGameError(null)}>
              OK
            </button>
          </div>
        </div>
      ) : null}

      {sessionTakenOver ? (
        <div className="alchemy-modal-backdrop">
          <div className="alchemy-popup">
            <h2>Session taken over</h2>
            <p>This session was opened on another device. You will be returned to the lobby.</p>
            <button type="button" className="alchemy-lobby-btn" onClick={dismissSessionTakenOver}>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
