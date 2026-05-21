import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCreditAmount } from "../lib/session-utils";
import type {
  HistoryDetailPayload,
  HistoryItem,
  HistoryListPayload,
  HistoryWinWay,
} from "../ws/protocol";

// ---------------------------------------------------------------------------
// Utility helpers (mirror App.tsx pattern, kept local to avoid coupling)
// ---------------------------------------------------------------------------

function winWayHighlightKey(reelIndex: number, rowIndex: number): string {
  return `${reelIndex}:${rowIndex}`;
}

function buildWinWayHighlightSet(way: HistoryWinWay | undefined): Set<string> {
  const keys = new Set<string>();
  if (!way?.positions) {
    return keys;
  }
  way.positions.forEach((rows, reelIndex) => {
    if (!rows) {
      return;
    }
    rows.forEach((rowIndex) => {
      keys.add(winWayHighlightKey(reelIndex, rowIndex));
    });
  });
  return keys;
}

function formatTs(ms: number): string {
  if (!ms) {
    return "—";
  }
  return new Date(ms).toLocaleString();
}

function profitClass(profit: number): string {
  if (profit > 0) {
    return "hist-profit-pos";
  }
  if (profit < 0) {
    return "hist-profit-neg";
  }
  return "";
}

function formatHistoryAmount(value: number): string {
  return formatCreditAmount(String(value));
}

function formatHistoryProfit(value: number): string {
  const formatted = formatHistoryAmount(Math.abs(value));
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `−${formatted}`;
  }
  return formatted;
}

// ---------------------------------------------------------------------------
// Sub-component: Level 2 — spin detail
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  detail: HistoryDetailPayload;
  onBack: () => void;
}

function DetailPanel({ detail, onBack }: Readonly<DetailPanelProps>) {
  const [highlightIndex, setHighlightIndex] = useState(0);

  const winWays = detail.winWays ?? [];
  const safeIndex =
    winWays.length === 0
      ? 0
      : Math.min(Math.max(highlightIndex, 0), winWays.length - 1);
  const highlightedWay = winWays[safeIndex];

  const highlightKeys = useMemo(
    () => buildWinWayHighlightSet(highlightedWay),
    [highlightedWay],
  );

  return (
    <div className="hist-detail">
      <div className="hist-detail-header row">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <span className="hist-detail-title">{detail.title}</span>
        <span className={`hist-type-badge hist-type-${detail.spinType}`}>
          {detail.spinType}
        </span>
      </div>

      <div className="hist-detail-meta snapshot">
        <div>
          <p className="hist-meta-row">
            <span className="hist-meta-label">Round</span>
            <code>{detail.roundId}</code>
          </p>
          <p className="hist-meta-row">
            <span className="hist-meta-label">Spin index</span>
            <code>{detail.spinIndex}</code>
          </p>
          <p className="hist-meta-row">
            <span className="hist-meta-label">Step</span>
            {detail.round} (0-idx: {detail.stepIndex})
          </p>
          <p className="hist-meta-row">
            <span className="hist-meta-label">Time</span>
            {formatTs(detail.finishedAtMillis)}
          </p>
        </div>
        <div>
          <p className="hist-meta-row">
            <span className="hist-meta-label">Bet</span>
            <span className="hist-amount">
              {formatHistoryAmount(detail.bet)}
            </span>
          </p>
          <p className="hist-meta-row">
            <span className="hist-meta-label">Win</span>
            <span className="hist-amount">{formatHistoryAmount(detail.win)}</span>
          </p>
          <p className="hist-meta-row">
            <span className="hist-meta-label">Profit</span>
            <span className={`hist-amount ${profitClass(detail.profit)}`}>
              {formatHistoryProfit(detail.profit)}
            </span>
          </p>
        </div>
      </div>

      {/* Reels grid */}
      <div className="output-section">
        <h3>Reels</h3>
        <div className="reels-wrap">
          <div className="reels" aria-label="History spin reels">
            {detail.reels.map((column, ci) => (
              <div
                key={`hist-reel-${ci}-len${column.length}`}
                className="reel-col"
              >
                {column.map((sym, ri) => {
                  const k = winWayHighlightKey(ci, ri);
                  const winHit = highlightKeys.has(k);
                  return (
                    <div
                      key={`hist-reel-${ci}-slot-${ri}`}
                      className={`cell sym-${sym}${winHit ? " cell-winway" : ""}`}
                    >
                      {sym}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Win ways table */}
      {winWays.length > 0 && (
        <div className="output-section">
          <h3>Win Ways</h3>
          <div className="hist-table-wrap">
            <table className="hist-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Symbol</th>
                  <th>Match</th>
                  <th>Ways</th>
                  <th>Payout</th>
                </tr>
              </thead>
              <tbody>
                {winWays.map((way, idx) => (
                  <tr
                    key={`hist-ww-${way.symbol}-${idx}`}
                    className={idx === safeIndex ? "hist-row-selected" : ""}
                    onClick={() => setHighlightIndex(idx)}
                  >
                    <td className="muted">{idx + 1}</td>
                    <td>
                      <span className={`cell sym-${way.symbol} hist-sym-mini`}>
                        {way.symbol}
                      </span>
                    </td>
                    <td>{way.matchCount}</td>
                    <td>{way.ways}</td>
                    <td>{way.payout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Level 1 — spin list
// ---------------------------------------------------------------------------

interface ListPanelProps {
  data: HistoryListPayload;
  page: number;
  loading: boolean;
  onPageChange: (next: number) => void;
  onSelectItem: (item: HistoryItem) => void;
}

function ListPanel({
  data,
  page,
  loading,
  onPageChange,
  onSelectItem,
}: Readonly<ListPanelProps>) {
  const totalPages = data.totalPage;
  const hasPrev = page > 1;
  const hasNext = page < data.totalPage;

  return (
    <div className="hist-list">
      <div className="hist-list-toolbar row">
        <span className="muted hist-count">
          {data.totalItems} spin{data.totalItems !== 1 ? "s" : ""} total
        </span>
        <div className="hist-pagination">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev || loading}
          >
            ← Prev
          </button>
          <span className="hist-page-info">
            {totalPages === 0 ? "0 / 0" : `${page} / ${totalPages}`}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext || loading}
          >
            Next →
          </button>
        </div>
      </div>

      {data.items.length === 0 ? (
        <p className="muted">No history yet.</p>
      ) : (
        <div className="hist-table-wrap">
          <table className="hist-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Round ID</th>
                <th>Type</th>
                <th className="hist-amount-col">Bet</th>
                <th className="hist-amount-col">Win</th>
                <th className="hist-amount-col">Profit</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={`${item.roundId}-${item.spinIndex}`}
                  className={loading ? undefined : "hist-row-clickable"}
                  role="button"
                  tabIndex={loading ? -1 : 0}
                  aria-label={`View spin ${item.stepIndex + 1}, round ${item.roundId}`}
                  onClick={() => {
                    if (!loading) {
                      onSelectItem(item);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (loading) {
                      return;
                    }
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectItem(item);
                    }
                  }}
                >
                  <td className="muted">{item.stepIndex + 1}</td>
                  <td>
                    <code className="hist-round-id" title={item.roundId}>
                      {item.roundId}
                    </code>
                  </td>
                  <td>
                    <span
                      className={`hist-type-badge hist-type-${item.spinType}`}
                    >
                      {item.spinType}
                    </span>
                  </td>
                  <td className="hist-amount">
                    {formatHistoryAmount(item.bet)}
                  </td>
                  <td className="hist-amount">
                    {formatHistoryAmount(item.win)}
                  </td>
                  <td className={`hist-amount ${profitClass(item.profit)}`}>
                    {formatHistoryProfit(item.profit)}
                  </td>
                  <td className="hist-ts muted">
                    {formatTs(item.timestampMillis)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export: HistoryView
// ---------------------------------------------------------------------------

export interface HistoryViewProps {
  /** true when session is joined and spin is not in-flight (safe to send cmds). */
  canQuery: boolean;
  /** `page` is 1-based (guide §8.1). */
  onFetchList: (page: number) => Promise<HistoryListPayload>;
  onFetchDetail: (
    roundId: string,
    spinIndex: number,
  ) => Promise<HistoryDetailPayload>;
}

export default function HistoryView({
  canQuery,
  onFetchList,
  onFetchDetail,
}: Readonly<HistoryViewProps>) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [page, setPage] = useState(1);
  const [listData, setListData] = useState<HistoryListPayload | null>(null);
  const [detailData, setDetailData] = useState<HistoryDetailPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref so the auto-fetch effect closure always sees latest canQuery
  // without re-triggering on each render.
  const canQueryRef = useRef(canQuery);
  canQueryRef.current = canQuery;

  const fetchList = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await onFetchList(targetPage);
        setListData(data);
        setPage(data.page);
        setView("list");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [onFetchList],
  );

  const fetchDetail = useCallback(
    async (roundId: string, spinIndex: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await onFetchDetail(roundId, spinIndex);
        setDetailData(data);
        setView("detail");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [onFetchDetail],
  );

  // Auto-fetch when this component mounts (i.e., when the History tab is opened).
  // If canQuery is not yet true (session not ready), skip and let the user
  // hit "Refresh" manually once connected.
  useEffect(() => {
    if (canQueryRef.current) {
      void fetchList(1);
    }
    // Only on mount — intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectItem = useCallback(
    (item: HistoryItem) => {
      void fetchDetail(item.roundId, item.spinIndex);
    },
    [fetchDetail],
  );

  const handleBack = useCallback(() => {
    setView("list");
    setDetailData(null);
  }, []);

  const handleRefresh = useCallback(() => {
    void fetchList(page);
  }, [fetchList, page]);

  const handlePageChange = useCallback(
    (next: number) => {
      void fetchList(next);
    },
    [fetchList],
  );

  return (
    <div className="panel hist-panel">
      <div className="hist-header row">
        <h2 style={{ margin: 0 }}>History</h2>
        {view === "list" && (
          <button
            type="button"
            className="primary"
            onClick={handleRefresh}
            disabled={!canQuery || loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {view === "detail" && detailData ? (
        <DetailPanel detail={detailData} onBack={handleBack} />
      ) : loading && !listData ? (
        <p className="muted">Loading…</p>
      ) : !listData ? (
        <p className="muted">
          {canQuery
            ? "Press Refresh to load history."
            : "Connect and join a game to view history."}
        </p>
      ) : (
        <ListPanel
          data={listData}
          page={page}
          loading={loading}
          onPageChange={handlePageChange}
          onSelectItem={handleSelectItem}
        />
      )}
    </div>
  );
}
