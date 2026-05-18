import { useState } from "react";
import CheatModal from "../components/CheatModal";
import HistoryView from "../components/HistoryView";
import JackpotPoolsBar from "../components/JackpotPoolsBar";
import JackpotWinnersView from "../components/JackpotWinnersView";
import SlotCabinet from "../components/SlotCabinet";
import WinWayReelGrid from "../components/WinWayReelGrid";
import type { GameSession } from "../hooks/useGameSession";

export default function GameScreen(session: Readonly<GameSession>) {
  const [cheatOpen, setCheatOpen] = useState(false);

  const {
    activeTab,
    setActiveTab,
    disconnect,
    phase,
    sessionReady,
    error,
    setBet,
    betLevels,
    selectBetValue,
    betLocked,
    spin,
    canSpin,
    canCheat,
    cheatGrid,
    cheatStatus,
    cheatSymbolOptions,
    sendCheat,
    sendForceJackpot,
    updateCheatCell,
    fetchHistoryList,
    fetchHistoryDetail,
    fetchJackpotWinHistory,
    jackpotWinnersRefreshToken,
    jackpotPoolsByTier,
    jackpotPoolsLoading,
    displaySpin,
    winWays,
    jackpotInfo,
    retriggerInfo,
    goldenWildHighlightKeys,
    featureBadges,
  } = session;

  const betDisabled =
    phase === "spinning" ||
    !sessionReady ||
    betLocked ||
    betLevels.length === 0;

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
          <div className="slot-stage-top">
            <JackpotPoolsBar
              poolsByTier={jackpotPoolsByTier}
              connected={sessionReady}
              loading={jackpotPoolsLoading}
            />
            {(error || phase !== "joined") && (
              <div className="slot-status-bar">
                <span className="slot-phase">
                  Phase: <strong>{phase}</strong>
                </span>
                {error ? <span className="error slot-error">{error}</span> : null}
              </div>
            )}
          </div>

          <div className="slot-playfield">
            <SlotCabinet
              banners={
                jackpotInfo?.triggered || retriggerInfo?.triggered ? (
                <>
                  {jackpotInfo?.triggered ? (
                    <div className="jackpot-banner slot-banner">
                      <strong>Jackpot</strong>{" "}
                      <span className="jackpot-tier">
                        {jackpotInfo.tier ?? "—"}
                      </span>
                      <span className="jackpot-win">
                        +{jackpotInfo.jackpotWin.toFixed(2)}
                      </span>
                      <span className="muted jackpot-cells">
                        ({jackpotInfo.goldenWildPositions.length} GW cells)
                      </span>
                    </div>
                  ) : null}
                  {retriggerInfo?.triggered ? (
                    <div className="jackpot-banner slot-banner">
                      <strong>Retrigger</strong>{" "}
                      <span className="jackpot-win">
                        +{retriggerInfo.addedFreeSpins} free spins
                      </span>
                      <span className="muted jackpot-cells">
                        ({retriggerInfo.scatterCount} scatters,{" "}
                        {retriggerInfo.scatterPositions.length} positions)
                      </span>
                    </div>
                  ) : null}
                </>
                ) : undefined
              }
              reels={
                displaySpin?.spin ? (
                  <WinWayReelGrid
                    cabinet
                    reels={displaySpin.spin.reels}
                    winWays={winWays}
                    goldenWildHighlightKeys={goldenWildHighlightKeys}
                    respinVisible={featureBadges.respin.visible}
                    respinRemaining={featureBadges.respin.remaining}
                    freeSpinVisible={featureBadges.freeSpin.visible}
                    freeSpinRemaining={featureBadges.freeSpin.remaining}
                  />
                ) : null
              }
              emptyMessage={
                !displaySpin
                  ? "Press Spin to play"
                  : !displaySpin.spin
                    ? "No spin data in this round"
                    : null
              }
              betValue={selectBetValue}
              betLevels={betLevels}
              onBetChange={setBet}
              betDisabled={betDisabled}
              canSpin={canSpin}
              spinning={phase === "spinning"}
              onSpin={() => void spin()}
            />
          </div>

          <button
            type="button"
            className="cheat-fab"
            onClick={() => setCheatOpen(true)}
            aria-label="Open cheat tools"
            title="Cheat tools (dev)"
          >
            <span className="cheat-fab-icon" aria-hidden>
              ⚙
            </span>
          </button>

          <CheatModal
            open={cheatOpen}
            onClose={() => setCheatOpen(false)}
            cheatGrid={cheatGrid}
            canCheat={canCheat}
            cheatStatus={cheatStatus}
            cheatSymbolOptions={cheatSymbolOptions}
            onCellChange={updateCheatCell}
            onSetCheat={sendCheat}
            onForceJackpot={sendForceJackpot}
          />
        </section>
      )}
    </>
  );
}
