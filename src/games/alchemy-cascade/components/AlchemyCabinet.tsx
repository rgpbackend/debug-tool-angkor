import type { ReactNode } from "react";
import { useState } from "react";
import type { GameSymbol } from "../../../ws/protocol";
import { formatAlchemyBalance } from "../lib/format";
import type { AlchemyDisplayCell, AlchemyTickerEntry } from "../lib/tumble";
import type { AlchemyFever } from "../alchemy-protocol";
import AlchemyControls from "./AlchemyControls";
import AlchemyGrid from "./AlchemyGrid";
import FeverMeter from "./FeverMeter";
import InfoBar from "./InfoBar";
import MenuPopover from "./MenuPopover";
import PaytableModal from "./PaytableModal";
import RulesModal from "./RulesModal";
import WinTicker from "./WinTicker";

type InfoBarMode = "idle" | "spinning" | "win";

type AlchemyCabinetProps = {
  cells: AlchemyDisplayCell[][];
  ticker: AlchemyTickerEntry[];
  infoMode: InfoBarMode;
  totalWin: string | null;
  winCapped: boolean;
  fever: AlchemyFever | null;
  goldenMultiplier: string | null;
  balance: string | null;
  toolbarSlot?: ReactNode;
  symbols: GameSymbol[];
  betLevels: string[];
  selectBetValue: string;
  onBetChange: (bet: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  fastSpin: boolean;
  onFastSpinToggle: () => void;
  onSpin: () => void;
  onBuy: () => void;
  buyCost: string;
  autoSpinActive: boolean;
  autoSpinCount: number | null;
  onAutoSpinStart: (count: number) => void;
  onAutoSpinStop: () => void;
};

export default function AlchemyCabinet({
  cells,
  ticker,
  infoMode,
  totalWin,
  winCapped,
  fever,
  goldenMultiplier,
  balance,
  toolbarSlot,
  symbols,
  betLevels,
  selectBetValue,
  onBetChange,
  betDisabled,
  canSpin,
  spinning,
  fastSpin,
  onFastSpinToggle,
  onSpin,
  onBuy,
  buyCost,
  autoSpinActive,
  autoSpinCount,
  onAutoSpinStart,
  onAutoSpinStop,
}: AlchemyCabinetProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);

  return (
    <section className="alchemy-cabinet">
      <header className="alchemy-toolbar">
        {toolbarSlot}
        <div className="alchemy-poster-name">
          <h1 className="alchemy-title">Alchemy Cascade</h1>
          <p className="alchemy-ways">8×8 cluster tumble</p>
        </div>
        <div className="alchemy-meter">
          <span className="alchemy-meter-label">Balance</span>
          <span className="alchemy-meter-value">
            {balance ? formatAlchemyBalance(balance) : "—"}
          </span>
        </div>
      </header>

      <AlchemyGrid cells={cells} doubleWild={fever?.doubleWild === true} />
      <WinTicker entries={ticker} />
      <InfoBar mode={infoMode} totalWin={totalWin} winCapped={winCapped} />
      <FeverMeter fever={fever} goldenMultiplier={goldenMultiplier} />
      <AlchemyControls
        betLevels={betLevels}
        selectBetValue={selectBetValue}
        onBetChange={onBetChange}
        betDisabled={betDisabled}
        canSpin={canSpin}
        spinning={spinning}
        fastSpin={fastSpin}
        onFastSpinToggle={onFastSpinToggle}
        onSpin={onSpin}
        onBuy={onBuy}
        buyCost={buyCost}
        autoSpinActive={autoSpinActive}
        autoSpinCount={autoSpinCount}
        onAutoSpinStart={onAutoSpinStart}
        onAutoSpinStop={onAutoSpinStop}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <MenuPopover
        open={menuOpen}
        soundOn={soundOn}
        musicOn={musicOn}
        onOpenPaytable={() => setPaytableOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        onToggleSound={() => setSoundOn((v) => !v)}
        onToggleMusic={() => setMusicOn((v) => !v)}
        onClose={() => setMenuOpen(false)}
      />
      <PaytableModal
        open={paytableOpen}
        symbols={symbols}
        bet={selectBetValue}
        onClose={() => setPaytableOpen(false)}
      />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </section>
  );
}
