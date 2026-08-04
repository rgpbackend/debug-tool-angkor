import { useCallback, useEffect, useState } from "react";
import type { TitanJackpotWinRecord, TitanJackpotWinHistoryPayload } from "../titan-protocol";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TIER_BADGE_CLASS: Record<string, string> = {
  GRAND: "tier-badge-grand",
  MAJOR: "tier-badge-major",
};

// ---------------------------------------------------------------------------
// Page dots
// ---------------------------------------------------------------------------

function PageDots({ page, total }: { page: number; total: number }) {
  if (total <= 1) return null;
  return (
    <span className="hist-dots">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i === page - 1 ? "hist-dot active" : "hist-dot"} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export interface JackpotHistoryModalProps {
  open: boolean;
  canQuery: boolean;
  onClose: () => void;
  onFetch: () => Promise<TitanJackpotWinHistoryPayload>;
}

export default function JackpotHistoryModal({
  open,
  canQuery,
  onClose,
  onFetch,
}: JackpotHistoryModalProps) {
  const [allItems, setAllItems] = useState<TitanJackpotWinRecord[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  const visibleItems = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const safePage = Math.min(page, totalPages);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onFetch();
      setAllItems(data.items);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [onFetch]);

  // Auto-fetch on open
  useEffect(() => {
    if (open && canQuery) {
      void fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="paytable-modal hist-modal" role="dialog" aria-modal="true" aria-label="Jackpot Winners">
        <header className="autospin-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Jackpot Winners</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="autospin-option" onClick={fetchData} disabled={!canQuery || loading} style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
              {loading ? "…" : "Refresh"}
            </button>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        {error && <p className="error" style={{ color: "#e74c3c", margin: "0 0 8px" }}>{error}</p>}

        <div className="hist-body">
          {loading && allItems.length === 0 ? (
            <p className="muted">Loading…</p>
          ) : !canQuery ? (
            <p className="muted">Connect and join a game to view jackpot winners.</p>
          ) : allItems.length === 0 ? (
            <p className="muted">No jackpot winners yet.</p>
          ) : (
            <>
              <div className="hist-list-toolbar">
                <span className="muted">{allItems.length} winner{allItems.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="hist-table-wrap">
                <table className="hist-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>User Name</th>
                      <th>Amount</th>
                      <th>Jackpot Type</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((r, idx) => (
                      <tr key={`${r.jackpotType}-${r.date}-${idx}`}>
                        <td className="muted">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td>{r.userName ?? "—"}</td>
                        <td className="hist-amount">${formatAmount(r.amount)}</td>
                        <td>
                          <span className={`hist-type-badge ${TIER_BADGE_CLASS[r.jackpotType] ?? ""}`}>
                            {r.jackpotType}
                          </span>
                        </td>
                        <td className="muted">{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="hist-pagination">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!hasPrev || loading}>
                  ← Prev
                </button>
                <PageDots page={safePage} total={totalPages} />
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={!hasNext || loading}>
                  Next →
                </button>
              </div>

              <p className="muted" style={{ textAlign: "center", marginTop: 12, fontSize: "0.75rem" }}>
                Note: Only showing latest 50 winners
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
