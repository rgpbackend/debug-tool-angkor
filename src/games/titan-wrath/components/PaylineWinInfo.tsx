import { usePaylineCycle } from "../hooks/usePaylineCycle";
import type { TitanPaylineWin } from "../titan-protocol";

interface PaylineWinInfoProps {
  paylineWins: TitanPaylineWin[];
}

export default function PaylineWinInfo({ paylineWins }: PaylineWinInfoProps) {
  // Use the same cycling hook but without spinning (already guarded by parent)
  const { activeWin, activeIdx, total } = usePaylineCycle(paylineWins, false);

  if (!activeWin) return null;

  return (
    <div className="titan-payline-info">
      <span className="titan-payline-label">{activeWin.paylineId}</span>
      <span className="titan-payline-amount">
        ${activeWin.winAmount.toFixed(2)}
      </span>
      {total > 1 && (
        <span className="titan-payline-counter">
          {activeIdx + 1}/{total}
        </span>
      )}
    </div>
  );
}
