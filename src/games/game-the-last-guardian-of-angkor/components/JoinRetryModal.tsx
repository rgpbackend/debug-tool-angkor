import { useEffect } from "react";

export type JoinRetryModalProps = {
  open: boolean;
  message: string;
  busy: boolean;
  onRetry: () => void;
  onLogout: () => void;
};

export default function JoinRetryModal({
  open,
  message,
  busy,
  onRetry,
  onLogout,
}: Readonly<JoinRetryModalProps>) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onLogout();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onLogout]);

  if (!open) {
    return null;
  }

  return (
    <div className="cheat-modal-root join-retry-modal-root" role="presentation">
      <div className="cheat-modal-backdrop" aria-hidden />
      <div
        className="cheat-modal panel join-retry-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="join-retry-modal-title"
      >
        <header className="cheat-modal-header">
          <h2 id="join-retry-modal-title">Could not join game</h2>
        </header>

        <p className="join-retry-modal-lead">
          The game server did not respond, but your connection is still open.
          You can try joining again.
        </p>

        {message ? (
          <p className="error join-retry-modal-error">{message}</p>
        ) : null}

        <div className="row cheat-modal-actions join-retry-modal-actions">
          <button
            type="button"
            className="primary"
            onClick={onRetry}
            disabled={busy}
          >
            {busy ? "Joining…" : "Retry join"}
          </button>
          <button type="button" onClick={onLogout} disabled={busy}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
