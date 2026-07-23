import type { JackpotPoolsByTier } from "../../../ws/protocol";

const TIER_ORDER = ["MINI", "MINOR", "MAJOR", "GRAND"] as const;

interface TitanJackpotBarProps {
  poolsByTier: JackpotPoolsByTier;
}

export default function TitanJackpotBar({ poolsByTier }: TitanJackpotBarProps) {
  return (
    <div className="titan-jackpot-bar">
      {TIER_ORDER.map((tier) => {
        const pool = poolsByTier[tier];
        const amount = pool?.currentAmount
          ? Number(pool.currentAmount).toFixed(2)
          : "0.00";
        return (
          <div key={tier} className={`jackpot-tier tier-${tier.toLowerCase()}`}>
            <span className="tier-label">{tier}</span>
            <span className="tier-amount">${amount}</span>
          </div>
        );
      })}
    </div>
  );
}
