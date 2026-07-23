import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSyncRef } from "../../hooks/useSyncRef";
import { useAutoSpin } from "./hooks/useAutoSpin";
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
    comboLevel,
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
  const [spinIndex, setSpinIndex] = useState(0);

  const spinUiActive = isSpinning;
  const spinUiActiveRef = useRef(spinUiActive);
  useSyncRef(spinUiActiveRef, spinUiActive);

  const roundIdle = !isSpinning;

  // Spin handler
  const executeSpin = useCallback(async () => {
    const result = await spin();
    if (result) {
      setSpinIndex((i) => i + 1);
      setAutoSpinRemaining((prev) => {
        if (prev === null) return null;
        if (prev === Infinity) return Infinity;
        return prev > 0 ? prev - 1 : 0;
      });
    }
  }, [spin]);

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
    canStartRound: canSpin && !spinUiActive,
    onRunRound: () => void executeSpin(),
  });

  // Handle respin chain — auto spin when round.state === "RESPIN"
  useEffect(() => {
    if (!viewSpin) return;
    if (viewSpin.round.state === "RESPIN" && roundIdle && canSpin) {
      const timer = window.setTimeout(() => {
        void executeSpin();
      }, 800);
      return () => window.clearTimeout(timer);
    }
  }, [viewSpin?.round.state, roundIdle, canSpin, executeSpin]);

  // Derived grid state
  const patternGrid = viewSpin?.spin?.patternGrid ?? "";
  const wildInfo = viewSpin?.spin?.titanWild;
  const currentTotalWin = viewSpin?.round?.totalWin ?? null;

  const betDisabled = isSpinning || !sessionReady || betLevels.length === 0;

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
        spinIndex={spinIndex}
        serverPaylines={serverPaylines}
        paylineWins={paylineWins}
        wildInfo={wildInfo}
        wildAnimDone={() => {}}
        comboLevel={comboLevel as "COMBO" | "SUPER_COMBO" | "MEGA_COMBO" | null}
        spinning={isSpinning}
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
