import {
  formatStaticJackpotPoolAmount,
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
  betAmount: string;
  connected: boolean;
  loading: boolean;
  canCheat?: boolean;
  forceJackpotBusy?: boolean;
  onForceJackpot?: (tier: JackpotTier) => void | Promise<void>;
  /** Compact strip below reel grid (no title, single row of 4). */
  embedded?: boolean;
}

function PoolCard({
  pool,
  tier,
  betAmount,
  canCheat = false,
  forceJackpotBusy = false,
  onForceJackpot,
}: Readonly<{
  pool: JackpotPool | null;
  tier: JackpotTier;
  betAmount: string;
  canCheat?: boolean;
  forceJackpotBusy?: boolean;
  onForceJackpot?: (tier: JackpotTier) => void | Promise<void>;
}>) {
  const isStatic = isStaticJackpotTier(tier);
  const staticAmount = formatStaticJackpotPoolAmount(betAmount, tier);
  const displayAmount = isStatic
    ? (staticAmount ?? "—")
    : (pool?.currentAmount ?? "—");
  const showCheatButton = Boolean(onForceJackpot);

  const handleForceJackpot = () => {
    if (!canCheat || forceJackpotBusy || !onForceJackpot) {
      return;
    }
    void onForceJackpot(tier);
  };

  return (
    <div
      className={`jackpot-pool-card jackpot-pool-${tier.toLowerCase()}${isStatic ? " jackpot-pool-static" : " jackpot-pool-progressive"}`}
    >
      <div className="jackpot-pool-card-top">
        <span className="jackpot-pool-tier">{TIER_LABELS[tier]}</span>
        {showCheatButton ? (
          <button
            type="button"
            className="jackpot-pool-cheat-btn"
            onClick={handleForceJackpot}
            disabled={!canCheat || forceJackpotBusy}
            title={`Force ${TIER_LABELS[tier]} jackpot on next base spin (2002)`}
            aria-label={`Cheat ${TIER_LABELS[tier]} jackpot`}
          >
            <span className="jackpot-pool-cheat-btn-icon" aria-hidden>
              ⚡
            </span>
          </button>
        ) : null}
      </div>
      <span className="jackpot-pool-amount">{displayAmount}</span>
    </div>
  );
}

function PoolGroup({
  tiers,
  poolsByTier,
  betAmount,
  canCheat,
  forceJackpotBusy,
  onForceJackpot,
}: Readonly<{
  tiers: readonly JackpotTier[];
  poolsByTier: JackpotPoolsByTier;
  betAmount: string;
  canCheat?: boolean;
  forceJackpotBusy?: boolean;
  onForceJackpot?: (tier: JackpotTier) => void | Promise<void>;
}>) {
  return (
    <div className="jackpot-pools-group">
      <div className="jackpot-pools-group-grid">
        {tiers.map((tier) => (
          <PoolCard
            key={tier}
            tier={tier}
            pool={poolsByTier[tier]}
            betAmount={betAmount}
            canCheat={canCheat}
            forceJackpotBusy={forceJackpotBusy}
            onForceJackpot={onForceJackpot}
          />
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
  betAmount,
  connected,
  loading,
  canCheat = false,
  forceJackpotBusy = false,
  onForceJackpot,
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
            <PoolCard
              key={tier}
              tier={tier}
              pool={poolsByTier[tier]}
              betAmount={betAmount}
              canCheat={canCheat}
              forceJackpotBusy={forceJackpotBusy}
              onForceJackpot={onForceJackpot}
            />
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
        <PoolGroup
          tiers={STATIC_JACKPOT_TIERS}
          poolsByTier={poolsByTier}
          betAmount={betAmount}
          canCheat={canCheat}
          forceJackpotBusy={forceJackpotBusy}
          onForceJackpot={onForceJackpot}
        />
        <PoolGroup
          tiers={PROGRESSIVE_JACKPOT_TIERS}
          poolsByTier={poolsByTier}
          betAmount={betAmount}
          canCheat={canCheat}
          forceJackpotBusy={forceJackpotBusy}
          onForceJackpot={onForceJackpot}
        />
      </div>
    </div>
  );
}
