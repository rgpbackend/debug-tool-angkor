import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { JackpotWinHistoryItem, JackpotWinHistoryPayload } from "../ws/protocol";

function formatTs(ms: number): string {
  if (!ms) {
    return "—";
  }
  return new Date(ms).toLocaleString();
}

function shortenId(id: string, max = 12): string {
  if (id.length <= max) {
    return id;
  }
  return `${id.slice(0, max)}…`;
}

const TIER_LABELS: Record<string, string> = {
  NANO: "Nano",
  CYBER: "Cyber",
  GUARDIAN: "Guardian",
  ETERNAL: "Eternal",
};

export interface JackpotWinnersViewProps {
  canQuery: boolean;
  onFetch: () => Promise<JackpotWinHistoryPayload>;
  /** Increment to trigger a refetch (e.g. after cmd 1521 push). */
  refreshToken?: number;
}

export default function JackpotWinnersView({
  canQuery,
  onFetch,
  refreshToken = 0,
}: Readonly<JackpotWinnersViewProps>) {
  const [items, setItems] = useState<JackpotWinHistoryItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canQueryRef = useRef(canQuery);
  useLayoutEffect(() => {
    canQueryRef.current = canQuery;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onFetch();
      setItems(data.items);
      setCount(data.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [onFetch]);

  useEffect(() => {
    if (canQueryRef.current) {
      void fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshToken > 0 && canQuery) {
      queueMicrotask(() => {
        void fetchData();
      });
    }
  }, [refreshToken, canQuery, fetchData]);

  return (
    <div className="panel hist-panel jackpot-winners-panel">
      <div className="hist-header row">
        <div>
          <h2 style={{ margin: 0 }}>Jackpot winners</h2>
          <p className="muted jackpot-winners-sub">Latest 10 wins</p>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => void fetchData()}
          disabled={!canQuery || loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && !items ? (
        <p className="muted">Loading…</p>
      ) : !items ? (
        <p className="muted">
          {canQuery
            ? "Press Refresh to load jackpot winners."
            : "Connect and join a game to view jackpot winners."}
        </p>
      ) : items.length === 0 ? (
        <p className="muted">No jackpot wins yet.</p>
      ) : (
        <>
          <p className="muted hist-count">
            Showing {count} win{count !== 1 ? "s" : ""}
          </p>
          <div className="hist-table-wrap">
            <table className="hist-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Tier</th>
                  <th>User</th>
                  <th>Win</th>
                  <th>Bet</th>
                  <th>Pool @ win</th>
                  <th>Round</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="hist-ts muted">
                      {formatTs(item.createdAt)}
                    </td>
                    <td>
                      <span
                        className={`jackpot-tier-badge jackpot-tier-${item.tier.toLowerCase()}`}
                      >
                        {TIER_LABELS[item.tier] ?? item.tier}
                      </span>
                    </td>
                    <td>
                      <code title={item.userId}>{shortenId(item.userId)}</code>
                    </td>
                    <td className="jackpot-win-cell">{item.winAmount}</td>
                    <td>{item.betAmount}</td>
                    <td className="muted">{item.poolAmountAtWin}</td>
                    <td>
                      <code title={item.roundId}>{shortenId(item.roundId)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
