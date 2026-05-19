import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAutoSpin } from "../hooks/useAutoSpin";
import { useRoundRunner } from "../hooks/useRoundRunner";
import HistoryModal from "../components/HistoryModal";
import JackpotPoolsBar from "../components/JackpotPoolsBar";
import JackpotWinnersModal from "../components/JackpotWinnersModal";
import SlotCabinet from "../components/SlotCabinet";
import SlotCelebrationOverlay from "../components/SlotCelebrationOverlay";
import SlotStageBlock from "../components/SlotStageBlock";
import WinWayReelGrid from "../components/WinWayReelGrid";
import { buildSpinCelebrations } from "../lib/spin-celebrations";
import type { GameSession } from "../hooks/useGameSession";
import type { SpinResponsePayload } from "../ws/protocol";

export default function GameScreen(session: Readonly<GameSession>) {
  const {
    disconnect,
    phase,
    sessionReady,
    error,
    setBet,
    betLevels,
    balance,
    selectBetValue,
    betLocked,
    spin,
    canSpin,
    canCheat,
    cheatGrid,
    cheatGridDirty,
    sendCheat,
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

  const [historyOpen, setHistoryOpen] = useState(false);
  const [jackpotOpen, setJackpotOpen] = useState(false);
  const [reelsPresenting, setReelsPresenting] = useState(false);
  const [autoSpinActive, setAutoSpinActive] = useState(false);
  const spinUiActive = isSpinning || reelsPresenting;
  const spinUiActiveRef = useRef(spinUiActive);
  spinUiActiveRef.current = spinUiActive;

  const { roundRunning, executeRound, cancelRound } = useRoundRunner({
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

  useEffect(() => {
    if (!sessionReady) {
      setAutoSpinActive(false);
    }
  }, [sessionReady]);

  const betDisabled =
    roundBusy ||
    !sessionReady ||
    betLocked ||
    betLevels.length === 0;

  const hasSpinReels = Boolean(viewSpin?.spin?.reels);

  const celebrations = useMemo(() => {
    if (spinUiActive || !viewSpin?.spin) {
      return [];
    }
    return buildSpinCelebrations(viewSpin as SpinResponsePayload, winWays);
  }, [spinUiActive, viewSpin, winWays]);

  useAutoSpin({
    active: autoSpinActive,
    roundIdle,
    canStartRound: controlsReady,
    onRunRound: executeRound,
  });

  const celebrationKey = useMemo(() => {
    if (!viewSpin?.spin?.reels) {
      return "";
    }
    return [
      viewSpin.round?.roundId ?? "",
      viewSpin.spin.spinType ?? "",
      viewSpin.spin.reels.flat().join(","),
      String(winWays.length),
    ].join("|");
  }, [viewSpin, winWays.length]);

  const canQueryHistory = sessionReady && phase !== "spinning";

  return (
    <>
      <div className="game-screen-toolbar row">
        <button type="button" className="logout-btn" onClick={disconnect}>
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
              spinning={roundBusy}
              onSpin={() => void executeRound()}
              autoSpinActive={autoSpinActive}
              onAutoSpinStart={startAutoSpin}
              onAutoSpinStop={stopAutoSpin}
              canCheat={canCheat}
              cheatGridDirty={cheatGridDirty}
              balance={balance}
              balanceConnected={sessionReady}
              onSetCheat={sendCheat}
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
