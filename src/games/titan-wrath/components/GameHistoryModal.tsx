import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  TitanHistoryItem,
  TitanHistoryListPayload,
  TitanHistoryDetailPayload,
  TitanHistoryWinWay,
  TitanHistorySpinType,
} from "../titan-protocol";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

function formatAmount(v: number): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatProfit(v: number): string {
  const a = formatAmount(Math.abs(v));
  if (v > 0) return `+$${a}`;
  if (v < 0) return `−$${a}`;
  return `$${a}`;
}

function profitClass(v: number): string {
  if (v > 0) return "hist-profit-pos";
  if (v < 0) return "hist-profit-neg";
  return "";
}

function spinTypeLabel(t: TitanHistorySpinType): string {
  return t === "RESPIN" ? "Respin" : "Base";
}

// ---------------------------------------------------------------------------
// Sub-component: Level 2 — Spin Detail
// ---------------------------------------------------------------------------

function winWayHighlightKey(reelIndex: number, rowIndex: number): string {
  return `${reelIndex}:${rowIndex}`;
}

function buildHighlightSet(
  way: TitanHistoryWinWay | undefined,
  detail: TitanHistoryDetailPayload,
): Set<string> {
  const keys = new Set<string>();
  if (!way || !detail.reels) return keys;
  // highlight the 3 cells in the winning payline's column based on the payline pattern
  // For Titan paylines (5 cols × 3 rows), we map paylineId to rows from the JOIN config.
  // Simplified: highlight all cells in columns where the symbol appears.
  // A proper implementation would look up the payline rows from serverPaylines.
  // For now, highlight with a simple approach using the paylineId.
  const cols = Math.min(detail.reels.length, 5);
  // Without server payline config, highlight by matching symbol in each column
  // that falls on the payline path. This is a best-effort visual.
  for (let c = 0; c < cols; c++) {
    const col = detail.reels[c];
    if (!col) continue;
    for (let r = 0; r < Math.min(col.length, 3); r++) {
      if (col[r] === way.symbol) {
        keys.add(winWayHighlightKey(c, r));
      }
    }
  }
  return keys;
}

interface DetailPanelProps {
  detail: TitanHistoryDetailPayload;
  onBack: () => void;
}

function DetailPanel({ detail, onBack }: DetailPanelProps) {
  const [highlightIdx, setHighlightIdx] = useState(0);
  const winWays = detail.winWays ?? [];
  const safeIdx = winWays.length === 0 ? 0 : Math.min(Math.max(highlightIdx, 0), winWays.length - 1);
  const highlightedWay = winWays[safeIdx];

  const highlightKeys = useMemo(
    () => buildHighlightSet(highlightedWay, detail),
    [highlightedWay, detail],
  );

  return (
    <div className="hist-detail">
      <div className="hist-detail-header">
        <button type="button" className="hist-back-btn" onClick={onBack}>
          ← Back
        </button>
        <span className="hist-detail-title">
          {spinTypeLabel(detail.spinType)} Spin
        </span>
        <span className={`hist-type-badge hist-type-${detail.spinType}`}>
          {detail.spinType}
        </span>
      </div>

      <div className="hist-detail-meta">
        <div>
          <p><span className="hist-label">Round</span> <code>{detail.roundId}</code></p>
          <p><span className="hist-label">Step</span> {detail.stepIndex + 1} / {detail.totalStepsInRound}</p>
          <p><span className="hist-label">Time</span> {formatTs(detail.timestamp)}</p>
        </div>
        <div>
          <p><span className="hist-label">Bet</span> <span className="hist-amount">${formatAmount(detail.bet)}</span></p>
          <p><span className="hist-label">Win</span> <span className="hist-amount">${formatAmount(detail.win)}</span></p>
          <p><span className="hist-label">Profit</span> <span className={`hist-amount ${profitClass(detail.profit)}`}>{formatProfit(detail.profit)}</span></p>
          {detail.jackpot?.triggered ? (
            <p><span className="hist-label">Jackpot</span> <span className="hist-amount jackpot-prize">{detail.jackpot.tier ?? "—"} · ${detail.jackpot.prize}</span></p>
          ) : null}
        </div>
      </div>

      {/* Reels grid */}
      <div className="hist-section">
        <h3>Reels</h3>
        <div className="hist-reels">
          {detail.reels.map((col, ci) => (
            <div key={`rcol-${ci}`} className="hist-reel-col">
              {col.map((sym, ri) => {
                const hit = highlightKeys.has(winWayHighlightKey(ci, ri));
                return (
                  <div key={`rc-${ci}-${ri}`} className={`hist-cell sym-${sym}${hit ? " hist-cell-hit" : ""}`}>
                    {sym}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Win ways */}
      {winWays.length > 0 && (
        <div className="hist-section">
          <h3>Win Ways</h3>
          <div className="hist-table-wrap">
            <table className="hist-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Payline</th>
                  <th>Symbol</th>
                  <th>Match</th>
                  <th>Win</th>
                  <th>Dir</th>
                </tr>
              </thead>
              <tbody>
                {winWays.map((way, idx) => (
                  <tr
                    key={`hw-${way.paylineId}-${idx}`}
                    className={idx === safeIdx ? "hist-row-sel" : ""}
                    onClick={() => setHighlightIdx(idx)}
                  >
                    <td className="muted">{idx + 1}</td>
                    <td>{way.paylineId}</td>
                    <td><span className={`hist-sym-mini sym-${way.symbol}`}>{way.symbol}</span></td>
                    <td>{way.count}</td>
                    <td>${way.win}</td>
                    <td className="muted">{way.direction}</td>
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
// Sub-component: Level 1 — Spin List
// ---------------------------------------------------------------------------

interface ListPanelProps {
  items: TitanHistoryItem[];
  page: number;
  totalPages: number;
  totalItems: number;
  loading: boolean;
  onPageChange: (next: number) => void;
  onSelectItem: (item: TitanHistoryItem) => void;
}

function ListPanel({
  items,
  page,
  totalPages,
  totalItems,
  loading,
  onPageChange,
  onSelectItem,
}: ListPanelProps) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="hist-list">
      <div className="hist-list-toolbar">
        <span className="muted">{totalItems} spin{totalItems !== 1 ? "s" : ""} total</span>
        <div className="hist-pagination">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={!hasPrev || loading}>
            ← Prev
          </button>
          <span className="hist-page-info">{page} / {totalPages}</span>
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={!hasNext || loading}>
            Next →
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="muted">No history yet.</p>
      ) : (
        <div className="hist-table-wrap">
          <table className="hist-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Round ID</th>
                <th>Type</th>
                <th>Bet</th>
                <th>Win</th>
                <th>Profit</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.roundId}-${item.spinIndex}`}
                  className={loading ? "" : "hist-row-clickable"}
                  role="button"
                  tabIndex={loading ? -1 : 0}
                  onClick={() => { if (!loading) onSelectItem(item); }}
                  onKeyDown={(e) => {
                    if (loading) return;
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectItem(item); }
                  }}
                >
                  <td className="muted">{item.stepIndex + 1}</td>
                  <td><code className="hist-round-id" title={item.roundId}>{item.roundId.slice(0, 12)}…</code></td>
                  <td><span className={`hist-type-badge hist-type-${item.spinType}`}>{spinTypeLabel(item.spinType)}</span></td>
                  <td className="hist-amount">${formatAmount(item.bet)}</td>
                  <td className="hist-amount">${formatAmount(item.win)}</td>
                  <td className={`hist-amount ${profitClass(item.profit)}`}>{formatProfit(item.profit)}</td>
                  <td className="muted hist-ts">{formatTs(item.timestamp)}</td>
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
// Main export: GameHistoryModal
// ---------------------------------------------------------------------------

export interface GameHistoryModalProps {
  open: boolean;
  canQuery: boolean;
  onClose: () => void;
  onFetchList: () => Promise<TitanHistoryListPayload>;
  onFetchDetail: (roundId: string, spinIndex: number) => Promise<TitanHistoryDetailPayload>;
}

export default function GameHistoryModal({
  open,
  canQuery,
  onClose,
  onFetchList,
  onFetchDetail,
}: GameHistoryModalProps) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [allItems, setAllItems] = useState<TitanHistoryItem[]>([]);
  const [detail, setDetail] = useState<TitanHistoryDetailPayload | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  const visibleItems = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const safePage = Math.min(page, totalPages);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onFetchList();
      setAllItems(data.items);
      setPage(1);
      setView("list");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [onFetchList]);

  // Auto-fetch on mount
  useEffect(() => {
    if (open && canQuery) {
      void fetchList();
    }
    // only on open transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSelectItem = useCallback(async (item: TitanHistoryItem) => {
    setLoading(true);
    setError(null);
    try {
      const d = await onFetchDetail(item.roundId, item.spinIndex);
      setDetail(d);
      setView("detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [onFetchDetail]);

  const handleBack = useCallback(() => {
    setView("list");
    setDetail(null);
  }, []);

  const handlePageChange = useCallback((next: number) => {
    setPage(Math.max(1, Math.min(next, totalPages)));
  }, [totalPages]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="paytable-modal hist-modal" role="dialog" aria-modal="true" aria-label="Game History">
        <header className="autospin-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Game History</span>
          <div style={{ display: "flex", gap: 8 }}>
            {view === "list" && (
              <button type="button" className="autospin-option" onClick={fetchList} disabled={!canQuery || loading} style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
                {loading ? "…" : "Refresh"}
              </button>
            )}
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        {error && <p className="error" style={{ color: "#e74c3c", margin: "0 0 8px" }}>{error}</p>}

        <div className="hist-body">
          {view === "detail" && detail ? (
            <DetailPanel detail={detail} onBack={handleBack} />
          ) : loading && allItems.length === 0 ? (
            <p className="muted">Loading…</p>
          ) : !canQuery ? (
            <p className="muted">Connect and join a game to view history.</p>
          ) : (
            <ListPanel
              items={visibleItems}
              page={safePage}
              totalPages={totalPages}
              totalItems={allItems.length}
              loading={loading}
              onPageChange={handlePageChange}
              onSelectItem={handleSelectItem}
            />
          )}
        </div>
      </div>
    </div>
  );
}
