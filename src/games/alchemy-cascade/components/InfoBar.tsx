import { formatAlchemyMoney } from "../lib/format";

type InfoBarMode = "idle" | "spinning" | "win";

type InfoBarProps = {
  mode: InfoBarMode;
  totalWin: string | null;
  winCapped: boolean;
};

export default function InfoBar({ mode, totalWin, winCapped }: InfoBarProps) {
  let copy = "Good luck";
  if (mode === "idle") copy = "Win up to 15000x Bet";
  if (mode === "spinning") copy = "Good luck";
  if (mode === "win" && totalWin) {
    copy = formatAlchemyMoney(totalWin);
  }

  return (
    <div className={`alchemy-infobar alchemy-infobar--${mode}`}>
      <p className="alchemy-infobar-text">{copy}</p>
      {mode === "win" && winCapped && totalWin ? (
        <p className="alchemy-infobar-cap">
          Maximum Win Cap reached. Only {formatAlchemyMoney(totalWin)} has been awarded for this
          spin.
        </p>
      ) : null}
    </div>
  );
}
