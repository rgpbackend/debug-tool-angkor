import {
  isStaticJackpotTier,
  PROGRESSIVE_JACKPOT_TIERS,
  STATIC_JACKPOT_TIERS,
  type JackpotPool,
  type JackpotPoolsByTier,
  type JackpotTier,
} from "../ws/protocol";

const TIER_LABELS: Record<JackpotTier, string> = {
  NANO: "Nano",
  CYBER: "Cyber",
  GUARDIAN: "Guardian",
  ETERNAL: "Eternal",
};

export interface JackpotPoolsBarProps {
  poolsByTier: JackpotPoolsByTier;
  connected: boolean;
  loading: boolean;
}

function PoolCard({
  pool,
  tier,
}: Readonly<{ pool: JackpotPool | null; tier: JackpotTier }>) {
  const isStatic = isStaticJackpotTier(tier);

  return (
    <div
      className={`jackpot-pool-card jackpot-pool-${tier.toLowerCase()}${isStatic ? " jackpot-pool-static" : " jackpot-pool-progressive"}`}
    >
      <span className="jackpot-pool-tier">{TIER_LABELS[tier]}</span>
      {isStatic ? (
        <>
          <span className="jackpot-pool-amount-label">Prize</span>
          <span className="jackpot-pool-amount">
            {pool?.seedAmount ?? "—"}
          </span>
        </>
      ) : (
        <>
          <span className="jackpot-pool-amount-label">Pool</span>
          <span className="jackpot-pool-amount">
            {pool?.currentAmount ?? "—"}
          </span>
        </>
      )}
    </div>
  );
}

function PoolGroup({
  title,
  tiers,
  poolsByTier,
}: Readonly<{
  title: string;
  tiers: readonly JackpotTier[];
  poolsByTier: JackpotPoolsByTier;
}>) {
  return (
    <div className="jackpot-pools-group">
      <h4 className="jackpot-pools-group-title">{title}</h4>
      <div className="jackpot-pools-group-grid">
        {tiers.map((tier) => (
          <PoolCard key={tier} tier={tier} pool={poolsByTier[tier]} />
        ))}
      </div>
    </div>
  );
}

export default function JackpotPoolsBar({
  poolsByTier,
  connected,
  loading,
}: Readonly<JackpotPoolsBarProps>) {
  const hasAnyPool = [...STATIC_JACKPOT_TIERS, ...PROGRESSIVE_JACKPOT_TIERS].some(
    (tier) => poolsByTier[tier] !== null,
  );

  return (
    <div
      className="jackpot-pools slot-stage-surface"
      aria-label="The Guardian's Eye jackpots"
    >
      <div className="jackpot-pools-header">
        <h3 className="jackpot-pools-title">The Guardian&apos;s Eye</h3>
        {loading && <span className="muted jackpot-pools-status">Updating…</span>}
        {!connected && (
          <span className="muted jackpot-pools-status">Connect to load pools</span>
        )}
        {connected && !loading && !hasAnyPool && (
          <span className="muted jackpot-pools-status">Awaiting pool data</span>
        )}
      </div>
      <div className="jackpot-pools-groups">
        <PoolGroup
          title="Static jackpots"
          tiers={STATIC_JACKPOT_TIERS}
          poolsByTier={poolsByTier}
        />
        <PoolGroup
          title="Progressive jackpots"
          tiers={PROGRESSIVE_JACKPOT_TIERS}
          poolsByTier={poolsByTier}
        />
      </div>
    </div>
  );
}
