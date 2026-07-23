import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAutoSpin } from "./hooks/useAutoSpin";
import { useSpinPhase } from "./hooks/useSpinPhase";
import { useTitanSession } from "./useTitanSession";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import TitanSlotMachine from "./components/TitanSlotMachine";
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
    { onTokenBan: onLogout, onConnectionLost: onLogout },
  );

  const {
    phase,
    sessionReady,
    joinGame,
    error,
    betLevels,
    balance,
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
    jackpotPoolsByTier,
  } = session;

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

  // Animation phase machine
  const hasWild = viewSpin?.spin?.titanWild?.triggered === true;
  const hasPaylineWins = paylineWins.length > 0;
  const spinPhase = useSpinPhase({
    spinTick,
    hasWild,
    hasPaylineWins,
    spinResponseReady,
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
      }, 800);
      return () => window.clearTimeout(timer);
    }
  }, [viewSpin?.round.state, spinPhase, canSpin, executeSpin]);

  // Derived grid state
  const patternGrid = viewSpin?.spin?.patternGrid ?? "";
  const wildInfo = viewSpin?.spin?.titanWild;
  const currentTotalWin = viewSpin?.round?.totalWin ?? null;

  const betDisabled = spinBusy || !sessionReady || betLevels.length === 0;

  const joining = !sessionReady && phase === "joining";

  if (joining) {
    return (
      <div className="titan-screen">
        <p className="titan-joining" role="status">Joining Titan&apos;s Wrath…</p>
      </div>
    );
  }

  return (
    <div className="titan-screen">
      <TitanSlotMachine
        patternGrid={patternGrid}
        lockedReels={lockedReels}
        spinPhase={spinPhase}
        serverPaylines={serverPaylines}
        paylineWins={paylineWins}
        wildInfo={wildInfo}
        wildAnimDone={() => {}}
        totalWin={currentTotalWin}
        jackpotPoolsByTier={jackpotPoolsByTier}
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
        balance={balance}
        toolbarSlot={
          <>
            <button type="button" className="titan-lobby-btn" onClick={onBackToLobby}>
              ← Lobby
            </button>
            <button type="button" className="titan-logout-btn" onClick={onLogout}>
              Log out
            </button>
          </>
        }
      />
    </div>
  );
}
