import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAutoSpin } from "./hooks/useAutoSpin";
import { useSpinPhase } from "./hooks/useSpinPhase";
import { useTitanSession } from "./useTitanSession";
import type { TitanJackpotTier } from "./titan-protocol";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import TitanSlotMachine from "./components/TitanSlotMachine";
import GameHistoryModal from "./components/GameHistoryModal";
import JackpotHistoryModal from "./components/JackpotHistoryModal";
import DebugCheatPanel from "./components/DebugCheatPanel";
import DebugMessageLog from "./components/DebugMessageLog";
import "./slot-machine.css";

export default function GameScreen({
  agencyUserToken: _agencyUserToken,
  wsAccessToken,
  balance: _parentBalance,
  depositBusy: _depositBusy,
  depositFunds: _depositFunds,
  onBackToLobby,
  onLogout,
}: GameScreenProps) {
  const defaults = useMemo(() => readEnvDefaults(), []);

  const session = useTitanSession(
    defaults.wsUrl,
    wsAccessToken,
    { onTokenBan: onLogout, onConnectionLost: onBackToLobby },
    _parentBalance,
  );

  const {
    clientRef,
    sessionReady,
    joinGame,
    error,
    betLevels,
    balance: wsBalance,
    selectBetValue,
    spin,
    canSpin,
    isSpinning,
    viewSpin,
    lockedReels,
    superBetActive,
    setSuperBetActive,
    superBetToggleable,
    paylineWins,
    symbolCatalog,
    serverPaylines,
    jackpotMeterTokens,
    jackpotTierConfig,
    lastJackpotWin,
    dismissJackpotCelebration,
    sessionTakenOver,
    dismissSessionTakenOver,
    fetchHistoryList,
    fetchHistoryDetail,
    fetchJackpotWinHistory,
  } = session;

  // Debug panel toggle
  const [debugOpen, setDebugOpen] = useState(true);

  // History modals
  const [historyOpen, setHistoryOpen] = useState(false);
  const [jackpotHistoryOpen, setJackpotHistoryOpen] = useState(false);
  const canQueryHistory = sessionReady && !isSpinning;

  // Join on mount
  useEffect(() => {
    if (session.gameScreenActive && !session.sessionReady) {
      void joinGame();
    }
  }, [session.gameScreenActive, session.sessionReady, joinGame]);

  // Auto-spin state
  const [autoSpinActive, setAutoSpinActive] = useState(false);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState<number | null>(null);
  const [spinTick, setSpinTick] = useState(0);
  const [reelsAnimating, setReelsAnimating] = useState(false);

  // Track spinResponseReady — true once isSpinning transitions false→ready for animation
  const [spinResponseReady, setSpinResponseReady] = useState(false);
  const wasSpinningRef = useRef(false);

  useEffect(() => {
    if (isSpinning) {
      wasSpinningRef.current = true;
      setSpinResponseReady(false);
    } else if (wasSpinningRef.current) {
      wasSpinningRef.current = false;
      setSpinResponseReady(true);
    }
  }, [isSpinning]);

  // Effects start only when BOTH response arrived AND reels stopped
  const readyForEffects = spinResponseReady && !reelsAnimating;

  // Animation phase machine
  const hasWild = viewSpin?.spin?.titanWild?.triggered === true;
  const hasPaylineWins = paylineWins.length > 0;
  const spinPhase = useSpinPhase({
    spinTick,
    hasWild,
    hasPaylineWins,
    readyForEffects,
  });

  // Reset spinResponseReady when phase goes idle (sequence complete)
  useEffect(() => {
    if (spinPhase === "idle") {
      setSpinResponseReady(false);
    }
  }, [spinPhase]);

  const spinBusy = spinPhase !== "idle";

  const roundIdle = !spinBusy;

  // Spin handler
  const executeSpin = useCallback(async () => {
    if (spinBusy) return;
    setSpinTick((t) => t + 1); // kick off SPINNING phase
    const result = await spin();
    if (result) {
      setAutoSpinRemaining((prev) => {
        if (prev === null) return null;
        if (prev === Infinity) return Infinity;
        return prev > 0 ? prev - 1 : 0;
      });
    }
  }, [spin, spinBusy]);

  // Auto-spin lifecycle
  const startAutoSpin = useCallback((count: number) => {
    setAutoSpinActive(true);
    setAutoSpinRemaining(count);
  }, []);

  const stopAutoSpin = useCallback(() => {
    setAutoSpinActive(false);
    setAutoSpinRemaining(null);
  }, []);

  // Stop auto-spin when count reaches 0
  useEffect(() => {
    if (autoSpinRemaining === 0) {
      stopAutoSpin();
    }
  }, [autoSpinRemaining, stopAutoSpin]);

  // Auto-spin scheduling
  useAutoSpin({
    active: autoSpinActive && sessionReady,
    roundIdle,
    canStartRound: canSpin && !spinBusy,
    onRunRound: () => void executeSpin(),
  });

  // Handle respin chain — auto spin AFTER animation sequence completes (phase = idle)
  useEffect(() => {
    if (!viewSpin) return;
    if (viewSpin.round.state === "RESPIN" && spinPhase === "idle" && canSpin) {
      const timer = window.setTimeout(() => {
        void executeSpin();
      }, 500);
      return () => window.clearTimeout(timer);
    }
  }, [viewSpin?.round.state, spinPhase, canSpin, executeSpin]);

  // Derived grid state
  const patternGrid = viewSpin?.spin?.patternGrid ?? "";
  const wildInfo = viewSpin?.spin?.titanWild;
  const currentTotalWin = viewSpin?.round?.totalWin ?? null;
  const tokenPositions = viewSpin?.spin?.tokenPositions ?? [];

  // Derived jackpot tier (highest reached) — driven by server config with fallback.
  const jackpotMeterTier = useMemo((): TitanJackpotTier | null => {
    let best: { tier: string; requiredTokens: number } | null = null;
    for (const t of jackpotTierConfig) {
      if (jackpotMeterTokens >= t.requiredTokens) {
        if (!best || t.requiredTokens > best.requiredTokens) {
          best = t;
        }
      }
    }
    return (best?.tier as TitanJackpotTier) ?? null;
  }, [jackpotMeterTokens, jackpotTierConfig]);

  // Use WS balance when available, fall back to agency balance from parent
  const displayBalance = wsBalance ?? _parentBalance ?? null;

  const betDisabled = spinBusy || !sessionReady || betLevels.length === 0;

  // Show joining screen until game is fully ready (covers connecting → joining phases)
  const joining = !sessionReady;

  if (joining) {
    return (
      <div className="titan-screen titan-screen--joining">
        <div className="titan-joining-card">
          <div className="titan-joining-emblem">⚡</div>
          <h1 className="titan-joining-title">Titan&apos;s Wrath</h1>
          <div className="titan-joining-forge">
            <div className="titan-joining-forge-bar" />
          </div>
          <p className="titan-joining-status" role="status">Forging connection…</p>
          <div className="titan-joining-actions">
            <button type="button" className="titan-lobby-btn" onClick={onBackToLobby}>
              ← Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="titan-screen">
      {/* Game panel — left side */}
      <div className="titan-game-panel">
        <TitanSlotMachine
          patternGrid={patternGrid}
          lockedReels={lockedReels}
          spinPhase={spinPhase}
          isSpinning={isSpinning}
          onPresentationChange={setReelsAnimating}
          serverPaylines={serverPaylines}
          paylineWins={paylineWins}
          wildInfo={wildInfo}
          wildAnimDone={() => {}}
          totalWin={currentTotalWin}
          betLevels={betLevels}
          selectBetValue={selectBetValue}
          onBetChange={session.setBet}
          betDisabled={betDisabled}
          canSpin={canSpin && !autoSpinActive}
          onSpin={() => void executeSpin()}
          autoSpinActive={autoSpinActive}
          autoSpinCount={autoSpinRemaining}
          onAutoSpinStart={startAutoSpin}
          onAutoSpinStop={stopAutoSpin}
          superBetActive={superBetActive}
          superBetToggleable={superBetToggleable}
          onSuperBetToggle={setSuperBetActive}
          error={error}
          symbols={symbolCatalog}
          balance={displayBalance}
          tokenPositions={tokenPositions}
          roundId={viewSpin?.round?.roundId ?? ""}
          jackpotMeterTokens={jackpotMeterTokens}
          jackpotMeterTier={jackpotMeterTier}
          jackpotTierConfig={jackpotTierConfig}
          lastJackpotWin={lastJackpotWin}
          onDismissJackpot={dismissJackpotCelebration}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenJackpotWinners={() => setJackpotHistoryOpen(true)}
          toolbarSlot={
            <button type="button" className="titan-lobby-btn" onClick={onBackToLobby}>
              ← Lobby
            </button>
          }
        />
      </div>

      {/* Debug panel — right side */}
      <div className={`titan-debug-panel${debugOpen ? "" : " collapsed"}`}>
        <button
          className="titan-debug-toggle"
          onClick={() => setDebugOpen((v) => !v)}
          aria-label={debugOpen ? "Collapse debug panel" : "Expand debug panel"}
        >
          {debugOpen ? "▶" : "◀"}
        </button>

        {/* Cheat section */}
        <div className="titan-debug-section">
          <div className="titan-debug-section-header">
            <span>Cheat Symbols</span>
          </div>
          <DebugCheatPanel
            clientRef={clientRef}
            canCheat={canSpin && !isSpinning && sessionReady}
            lastPatternGrid={viewSpin?.spin?.patternGrid ?? ""}
          />
        </div>

        {/* Message log section */}
        <div className="titan-debug-section">
          <div className="titan-debug-section-header">
            <span>Message Log</span>
          </div>
          <DebugMessageLog
            clientRef={clientRef}
            sessionReady={sessionReady}
          />
        </div>
      </div>

      {/* History modals */}
      <GameHistoryModal
        open={historyOpen}
        canQuery={canQueryHistory}
        onClose={() => setHistoryOpen(false)}
        onFetchList={fetchHistoryList}
        onFetchDetail={fetchHistoryDetail}
      />
      <JackpotHistoryModal
        open={jackpotHistoryOpen}
        canQuery={canQueryHistory}
        onClose={() => setJackpotHistoryOpen(false)}
        onFetch={fetchJackpotWinHistory}
      />

      {/* Error popup */}
      {error && (
        <div className="titan-insufficient-overlay" onClick={() => session.setGameError(null)}>
          <div className="titan-insufficient-popup" onClick={(e) => e.stopPropagation()}>
            <div className="titan-insufficient-icon">⚠️</div>
            <h2>Error</h2>
            <p>{error}</p>
            <button className="titan-insufficient-ok" onClick={() => session.setGameError(null)}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Session Taken Over popup */}
      {sessionTakenOver && (
        <div className="titan-insufficient-overlay">
          <div className="titan-insufficient-popup" onClick={(e) => e.stopPropagation()}>
            <div className="titan-insufficient-icon">🔌</div>
            <h2>Session Taken Over</h2>
            <p>This session was opened on another device. You will be returned to the lobby.</p>
            <button className="titan-insufficient-ok" onClick={dismissSessionTakenOver}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
