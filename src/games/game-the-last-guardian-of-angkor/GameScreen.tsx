import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSyncRef } from "../../hooks/useSyncRef";
import { useAutoSpin } from "./hooks/useAutoSpin";
import { useRoundRunner } from "./hooks/useRoundRunner";
import HistoryModal from "./components/HistoryModal";
import JackpotPoolsBar from "./components/JackpotPoolsBar";
import JackpotWinnersModal from "./components/JackpotWinnersModal";
import SlotCabinet from "./components/SlotCabinet";
import SlotCelebrationOverlay from "./components/SlotCelebrationOverlay";
import SlotStageBlock from "./components/SlotStageBlock";
import WinWayReelGrid from "./components/WinWayReelGrid";
import { buildSpinCelebrations } from "./lib/celebrations";
import { useGameSession } from "./useGameSession";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import type { SpinResponsePayload } from "./lib/protocol";
import type { JackpotTierInfo } from "../../ws/protocol";
import "./slot-cabinet.css";

const ANGKOR_JACKPOT_TIERS: JackpotTierInfo[] = [
  { key: "NANO", isStatic: true, betMultiplier: 20 },
  { key: "CYBER", isStatic: true, betMultiplier: 50 },
  { key: "GUARDIAN", isStatic: false },
  { key: "ETERNAL", isStatic: false },
];

export default function GameScreen({
  agencyUserToken,
  wsAccessToken,
  balance: parentBalance,
  depositBusy,
  depositFunds,
  onBackToLobby,
  onLogout,
}: GameScreenProps) {
  const defaults = useMemo(() => readEnvDefaults(), []);

  const session = useGameSession(
    defaults.wsUrl,
    "game-the-last-guardian-of-angkor",
    "AGENCY_001",
    ANGKOR_JACKPOT_TIERS,
    wsAccessToken,
    { onTokenBan: onLogout, onConnectionLost: onLogout },
    () => depositFunds?.() ?? Promise.resolve(),
    agencyUserToken,
    parentBalance ?? null,
    depositBusy ?? false,
  );

  const {
    sessionReady,
    joinGame,
    error,
    setBet,
    betLevels,
    balance,
    canDeposit,
    selectBetValue,
    betLocked,
    spin,
    canSpin,
    canCheat,
    cheatGrid,
    cheatGridDirty,
    cheatInputRejectTick,
    cheatArmed,
    sendCheat,
    discardCheatGrid,
    sendForceJackpot,
    forceJackpotBusy,
    updateCheatCell,
    fetchHistoryList,
    fetchHistoryDetail,
    fetchJackpotWinHistory,
    jackpotWinnersRefreshToken,
    jackpotPoolsByTier,
    jackpotPoolsLoading,
    viewSpin,
    isSpinning,
    winWays,
    goldenWildHighlightKeys,
    featureBadges,
  } = session;

  useEffect(() => {
    if (session.gameScreenActive && !session.sessionReady) {
      void joinGame();
    }
  }, [session.gameScreenActive, session.sessionReady, joinGame]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [jackpotOpen, setJackpotOpen] = useState(false);
  const [reelsPresenting, setReelsPresenting] = useState(false);
  const [autoSpinActive, setAutoSpinActive] = useState(false);
  const spinUiActive = isSpinning || reelsPresenting;
  const spinUiActiveRef = useRef(spinUiActive);
  useSyncRef(spinUiActiveRef, spinUiActive);

  const { roundRunning, executeRound, executeStep, cancelRound } =
    useRoundRunner({
      spin,
      isSpinUiActive: () => spinUiActiveRef.current,
      canStartRound: canSpin && !spinUiActive,
    });

  const roundBusy = roundRunning || spinUiActive;
  const roundIdle = !roundBusy;
  const controlsReady = canSpin && !roundRunning && !spinUiActive;

  const stopAutoSpin = useCallback(() => {
    setAutoSpinActive(false);
    cancelRound();
  }, [cancelRound]);

  const startAutoSpin = useCallback(() => {
    setAutoSpinActive(true);
    if (roundIdle && controlsReady) {
      void executeRound();
    }
  }, [executeRound, controlsReady, roundIdle]);

  useAutoSpin({
    active: autoSpinActive && sessionReady,
    roundIdle,
    canStartRound: canSpin && !spinUiActive,
    onRunRound: () => void executeRound(),
  });

  const betDisabled =
    roundBusy || !sessionReady || betLocked || betLevels.length === 0;

  const hasSpinReels = Boolean(viewSpin?.spin?.reels);

  const celebrations = useMemo(() => {
    if (spinUiActive || !viewSpin?.spin) return [];
    return buildSpinCelebrations(viewSpin as SpinResponsePayload, winWays);
  }, [spinUiActive, viewSpin, winWays]);

  useAutoSpin({
    active: autoSpinActive,
    roundIdle,
    canStartRound: controlsReady,
    onRunRound: executeRound,
  });

  const celebrationKey = useMemo(() => {
    if (!viewSpin?.spin?.reels) return "";
    return [
      viewSpin.round?.roundId ?? "",
      viewSpin.spin.spinType ?? "",
      viewSpin.spin.reels.flat().join(","),
      String(winWays.length),
    ].join("|");
  }, [viewSpin, winWays.length]);

  const canQueryHistory = sessionReady && !isSpinning;
  // Show joining screen until game is fully ready (covers connecting → joining phases)
  const joining = !sessionReady;

  if (joining) {
    return (
      <div className="angkor-screen angkor-screen--joining">
        <div className="angkor-joining-card">
          <div className="angkor-joining-sigil">
            <div className="angkor-joining-sigil-ring" />
            <span className="angkor-joining-sigil-icon">🏛️</span>
          </div>
          <h1 className="angkor-joining-title">The Last Guardian</h1>
          <p className="angkor-joining-sub">of Angkor</p>
          <div className="angkor-joining-pulse">
            <div className="angkor-joining-pulse-dot" />
          </div>
          <p className="angkor-joining-status" role="status">Entering the temple…</p>
          <div className="angkor-joining-actions">
            <button type="button" className="lobby-btn" onClick={onBackToLobby}>
              ← Lobby
            </button>
            <button type="button" className="logout-btn" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="game-screen-toolbar row">
        <button type="button" onClick={onBackToLobby}>
          ← Lobby
        </button>
        <button type="button" className="logout-btn" onClick={onLogout}>
          Log out
        </button>
      </div>

      <section className="panel slot-stage">
        <div className="slot-stage-stack">
          <SlotStageBlock className="slot-playfield">
            <SlotCabinet
              statusError={error}
              onOpenHistory={() => setHistoryOpen(true)}
              onOpenJackpot={() => setJackpotOpen(true)}
              jackpotPools={
                <JackpotPoolsBar
                  embedded
                  betAmount={selectBetValue}
                  poolsByTier={jackpotPoolsByTier}
                  connected={sessionReady}
                  loading={jackpotPoolsLoading && !isSpinning}
                  canCheat={canCheat}
                  forceJackpotBusy={forceJackpotBusy}
                  onForceJackpot={sendForceJackpot}
                  jackpotTiers={ANGKOR_JACKPOT_TIERS}
                />
              }
              celebrations={
                <SlotCelebrationOverlay
                  items={celebrations}
                  visible={!spinUiActive && celebrations.length > 0}
                  resetKey={celebrationKey}
                />
              }
              reels={
                hasSpinReels && viewSpin?.spin ? (
                  <WinWayReelGrid
                    cabinet
                    editable
                    spinning={isSpinning}
                    onPresentationChange={setReelsPresenting}
                    editGrid={cheatGrid}
                    editDisabled={!canCheat || roundBusy}
                    onEditCellChange={updateCheatCell}
                    cheatGridDirty={cheatGridDirty}
                    cheatInputRejectTick={cheatInputRejectTick}
                    cheatArmed={cheatArmed}
                    canCheat={canCheat}
                    onConfirmCheat={sendCheat}
                    onDiscardCheat={discardCheatGrid}
                    reels={viewSpin.spin.reels}
                    winWays={winWays}
                    goldenWildHighlightKeys={goldenWildHighlightKeys}
                    respinVisible={featureBadges.respin.visible}
                    respinRemaining={featureBadges.respin.remaining}
                    freeSpinVisible={featureBadges.freeSpin.visible}
                    freeSpinRemaining={featureBadges.freeSpin.remaining}
                    freeSpinScatterCollected={
                      featureBadges.freeSpin.scatterCollected
                    }
                    freeSpinScatterTarget={
                      featureBadges.freeSpin.scatterTarget
                    }
                  />
                ) : null
              }
              emptyMessage={
                !viewSpin
                  ? "Press Spin to play"
                  : !viewSpin.spin
                    ? "No spin data in this round"
                    : null
              }
              betValue={selectBetValue}
              betLevels={betLevels}
              onBetChange={setBet}
              betDisabled={betDisabled}
              canSpin={controlsReady}
              canSpinControls={controlsReady && !autoSpinActive}
              spinning={roundBusy}
              onSpin={() => void executeRound()}
              onManualSpin={() => void executeStep()}
              autoSpinActive={autoSpinActive}
              onAutoSpinStart={startAutoSpin}
              onAutoSpinStop={stopAutoSpin}
              balance={balance}
              balanceConnected={sessionReady}
              canDeposit={canDeposit}
              depositBusy={session.depositBusy}
              onDeposit={() => void session.depositFunds()}
            />
          </SlotStageBlock>
        </div>
      </section>

      <HistoryModal
        open={historyOpen}
        canQuery={canQueryHistory}
        onFetchList={fetchHistoryList}
        onFetchDetail={fetchHistoryDetail}
        onClose={() => setHistoryOpen(false)}
      />
      <JackpotWinnersModal
        open={jackpotOpen}
        canQuery={canQueryHistory}
        onFetch={fetchJackpotWinHistory}
        refreshToken={jackpotWinnersRefreshToken}
        onClose={() => setJackpotOpen(false)}
      />
    </>
  );
}
