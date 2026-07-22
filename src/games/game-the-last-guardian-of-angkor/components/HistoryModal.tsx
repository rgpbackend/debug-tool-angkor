import { useEffect } from "react";
import HistoryView from "./HistoryView";
import type { HistoryViewProps } from "./HistoryView";

export type HistoryModalProps = {
  open: boolean;
  onClose: () => void;
} & Pick<HistoryViewProps, "canQuery" | "onFetchList" | "onFetchDetail">;

export default function HistoryModal({
  open,
  canQuery,
  onFetchList,
  onFetchDetail,
  onClose,
}: Readonly<HistoryModalProps>) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="cheat-modal-root history-modal-root" role="presentation">
      <button
        type="button"
        className="cheat-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="cheat-modal panel history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        <header className="cheat-modal-header">
          <h2 id="history-modal-title">History</h2>
          <button
            type="button"
            className="cheat-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="history-modal-body">
          <HistoryView
            canQuery={canQuery}
            onFetchList={onFetchList}
            onFetchDetail={onFetchDetail}
          />
        </div>
      </div>
    </div>
  );
}
