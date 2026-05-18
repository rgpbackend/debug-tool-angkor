import {
  isStaticJackpotTier,
  JACKPOT_TIERS,
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
  /** Compact strip below reel grid (no title, single row of 4). */
  embedded?: boolean;
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
      <span className="jackpot-pool-amount">
        {isStatic ? (pool?.seedAmount ?? "—") : (pool?.currentAmount ?? "—")}
      </span>
    </div>
  );
}

function PoolGroup({
  tiers,
  poolsByTier,
}: Readonly<{
  tiers: readonly JackpotTier[];
  poolsByTier: JackpotPoolsByTier;
}>) {
  return (
    <div className="jackpot-pools-group">
      <div className="jackpot-pools-group-grid">
        {tiers.map((tier) => (
          <PoolCard key={tier} tier={tier} pool={poolsByTier[tier]} />
        ))}
      </div>
    </div>
  );
}

function PoolStatus({
  connected,
  loading,
  hasAnyPool,
}: Readonly<{
  connected: boolean;
  loading: boolean;
  hasAnyPool: boolean;
}>) {
  if (loading) {
    return <span className="muted jackpot-pools-status">Updating…</span>;
  }
  if (!connected) {
    return (
      <span className="muted jackpot-pools-status">Connect to load pools</span>
    );
  }
  if (!hasAnyPool) {
    return (
      <span className="muted jackpot-pools-status">Awaiting pool data</span>
    );
  }
  return null;
}

export default function JackpotPoolsBar({
  poolsByTier,
  connected,
  loading,
  embedded = false,
}: Readonly<JackpotPoolsBarProps>) {
  const hasAnyPool = JACKPOT_TIERS.some((tier) => poolsByTier[tier] !== null);

  if (embedded) {
    return (
      <div
        className="jackpot-pools jackpot-pools--embedded"
        aria-label="Jackpot pools"
      >
        <PoolStatus
          connected={connected}
          loading={loading}
          hasAnyPool={hasAnyPool}
        />
        <div className="jackpot-pools-embedded-grid">
          {JACKPOT_TIERS.map((tier) => (
            <PoolCard key={tier} tier={tier} pool={poolsByTier[tier]} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="jackpot-pools slot-stage-surface"
      aria-label="The Guardian's Eye jackpots"
    >
      <div className="jackpot-pools-header">
        <h3 className="jackpot-pools-title">The Guardian&apos;s Eye</h3>
        <PoolStatus
          connected={connected}
          loading={loading}
          hasAnyPool={hasAnyPool}
        />
      </div>
      <div className="jackpot-pools-groups">
        <PoolGroup tiers={STATIC_JACKPOT_TIERS} poolsByTier={poolsByTier} />
        <PoolGroup
          tiers={PROGRESSIVE_JACKPOT_TIERS}
          poolsByTier={poolsByTier}
        />
      </div>
    </div>
  );
}
