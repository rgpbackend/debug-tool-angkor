import { useMemo } from "react";
import HistoryView from "../components/HistoryView";
import JackpotPoolsBar from "../components/JackpotPoolsBar";
import JackpotWinnersView from "../components/JackpotWinnersView";
import SlotCabinet from "../components/SlotCabinet";
import SlotCelebrationOverlay from "../components/SlotCelebrationOverlay";
import SlotStageBlock from "../components/SlotStageBlock";
import WinWayReelGrid from "../components/WinWayReelGrid";
import { buildSpinCelebrations } from "../lib/spin-celebrations";
import type { GameSession } from "../hooks/useGameSession";
import type { SpinResponsePayload } from "../ws/protocol";

export default function GameScreen(session: Readonly<GameSession>) {
  const {
    activeTab,
    setActiveTab,
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

  const betDisabled =
    phase === "spinning" ||
    !sessionReady ||
    betLocked ||
    betLevels.length === 0;

  const hasSpinReels = Boolean(viewSpin?.spin?.reels);

  const celebrations = useMemo(() => {
    if (isSpinning || !viewSpin?.spin) {
      return [];
    }
    return buildSpinCelebrations(viewSpin as SpinResponsePayload, winWays);
  }, [isSpinning, viewSpin, winWays]);

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

  return (
    <>
      <div className="game-screen-toolbar row">
        <div className="tab-bar game-tab-bar">
          <button
            type="button"
            className={`tab${activeTab === "game" ? " tab-active" : ""}`}
            onClick={() => setActiveTab("game")}
          >
            Game
          </button>
          <button
            type="button"
            className={`tab${activeTab === "history" ? " tab-active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
          <button
            type="button"
            className={`tab${activeTab === "jackpots" ? " tab-active" : ""}`}
            onClick={() => setActiveTab("jackpots")}
          >
            Jackpot
          </button>
        </div>
        <button type="button" className="logout-btn" onClick={disconnect}>
          Log out
        </button>
      </div>

      {activeTab === "history" ? (
        <HistoryView
          canQuery={sessionReady && phase !== "spinning"}
          onFetchList={fetchHistoryList}
          onFetchDetail={fetchHistoryDetail}
        />
      ) : activeTab === "jackpots" ? (
        <JackpotWinnersView
          canQuery={sessionReady && phase !== "spinning"}
          onFetch={fetchJackpotWinHistory}
          refreshToken={jackpotWinnersRefreshToken}
        />
      ) : (
        <section className="panel slot-stage">
          <div className="slot-stage-stack">
            <SlotStageBlock className="slot-playfield">
              <SlotCabinet
                statusError={error}
                jackpotPools={
                  <JackpotPoolsBar
                    embedded
                    poolsByTier={jackpotPoolsByTier}
                    connected={sessionReady}
                    loading={jackpotPoolsLoading && !isSpinning}
                  />
                }
                celebrations={
                  <SlotCelebrationOverlay
                    items={celebrations}
                    visible={!isSpinning && celebrations.length > 0}
                    resetKey={celebrationKey}
                  />
                }
                reels={
                  hasSpinReels && viewSpin?.spin ? (
                    <WinWayReelGrid
                      cabinet
                      editable
                      editGrid={cheatGrid}
                      editDisabled={!canCheat || isSpinning}
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
                canSpin={canSpin}
                spinning={isSpinning}
                onSpin={() => void spin()}
                canCheat={canCheat}
                cheatGridDirty={cheatGridDirty}
                balance={balance}
                balanceConnected={sessionReady}
                forceJackpotBusy={forceJackpotBusy}
                onSetCheat={sendCheat}
                onForceJackpot={sendForceJackpot}
              />
            </SlotStageBlock>
          </div>
        </section>
      )}
    </>
  );
}
