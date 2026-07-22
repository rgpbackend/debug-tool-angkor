import { useEffect, useMemo } from "react";
import { useGameSession } from "./useGameSession";
import TitanCabinet from "./components/TitanCabinet";
import PaylineReelGrid from "./components/PaylineReelGrid";
import TitanControls from "./components/TitanControls";
import TitanCelebrationOverlay from "./components/TitanCelebrationOverlay";
import ComboOverlay from "./components/ComboOverlay";
import { buildTitanCelebrations } from "./lib/celebrations";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import type { JackpotTierInfo } from "../../ws/protocol";
import "./titan.css";

const TITAN_JACKPOT_TIERS: JackpotTierInfo[] = [
  { key: "MINI", isStatic: false },
  { key: "MINOR", isStatic: false },
  { key: "MAJOR", isStatic: false },
  { key: "GRAND", isStatic: false },
];

export default function GameScreen({ wsAccessToken, onBackToLobby, onLogout }: GameScreenProps) {
  const defaults = useMemo(() => readEnvDefaults(), []);

  const session = useGameSession(
    defaults.wsUrl, "yama_01021", "AGENCY_001",
    TITAN_JACKPOT_TIERS, wsAccessToken,
    { onTokenBan: onLogout, onConnectionLost: onLogout },
  );

  useEffect(() => {
    if (session.gameScreenActive && !session.sessionReady) {
      void session.joinGame();
    }
  }, [session.gameScreenActive, session.sessionReady, session.joinGame]);

  const spinUiActive = session.isSpinning;

  const celebrations = useMemo(() => {
    if (spinUiActive || !session.lastSpin?.spin) return [];
    return buildTitanCelebrations(session.lastSpin, session.comboResult.comboLevel);
  }, [spinUiActive, session.lastSpin, session.comboResult.comboLevel]);

  const celebrationKey = useMemo(() => {
    if (!session.lastSpin?.spin?.reels) return "";
    return [session.lastSpin.round?.roundId ?? "", session.lastSpin.spin.spinType ?? "", session.lastSpin.spin.reels.flat().join(",")].join("|");
  }, [session.lastSpin]);

  const joining = !session.sessionReady && session.phase === "joining";

  return (
    <div className="titan-game-screen">
      <div className="titan-toolbar">
        <button onClick={onBackToLobby}>← Lobby</button>
        <button className="titan-logout-btn" onClick={onLogout}>Log out</button>
      </div>

      {joining ? <p className="titan-joining">Joining Titan's Wrath…</p> : null}

      <TitanCabinet
        error={session.error}
        reels={
          <PaylineReelGrid
            reels={session.lastSpin?.spin?.reels ?? Array.from({ length: 5 }, () => ["?", "?", "?"])}
            matches={session.comboResult.matches}
            spinning={session.isSpinning}
          />
        }
        celebrations={
          <TitanCelebrationOverlay items={celebrations} visible={!spinUiActive && celebrations.length > 0} resetKey={celebrationKey} />
        }
        combo={<ComboOverlay level={session.comboResult.comboLevel} visible={!spinUiActive && session.comboResult.comboLevel !== "none"} />}
        controls={
          <TitanControls
            betValue={session.bet}
            betLevels={session.betLevels}
            onBetChange={session.setBet}
            betDisabled={spinUiActive || !session.sessionReady}
            canSpin={session.canSpin && !spinUiActive}
            spinning={spinUiActive}
            onSpin={() => void session.spin()}
            autoSpinCount={session.autoSpinCount}
            onAutoSpinChange={session.setAutoSpinCount}
            fastSpin={session.fastSpin}
            onFastSpinToggle={() => session.setFastSpin(!session.fastSpin)}
            superBet={session.superBet}
            onSuperBetToggle={() => session.setSuperBet(!session.superBet)}
            balance={session.balance}
            connected={session.sessionReady}
          />
        }
      />
    </div>
  );
}
