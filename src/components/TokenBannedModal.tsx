import { useEffect } from "react";

export type TokenBannedModalProps = {
  open: boolean;
  tokenPreview: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function TokenBannedModal({
  open,
  tokenPreview,
  busy,
  onConfirm,
  onCancel,
}: Readonly<TokenBannedModalProps>) {
  useEffect(() => {
    if (!open || busy) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="cheat-modal-root token-ban-modal-root" role="presentation">
      <button
        type="button"
        className="cheat-modal-backdrop"
        aria-label="Close"
        onClick={onCancel}
        disabled={busy}
      />
      <div
        className="cheat-modal panel token-ban-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-ban-modal-title"
      >
        <header className="cheat-modal-header">
          <h2 id="token-ban-modal-title">Token banned</h2>
        </header>

        <p className="token-ban-modal-lead">
          The access token is banned (STOMP error 105). Reset it on the server
          and try connecting again?
        </p>
        <p className="token-ban-modal-token muted">
          Token: <code>{tokenPreview}</code>
        </p>

        <div className="row token-ban-modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Resetting…" : "Reset token"}
          </button>
        </div>
      </div>
    </div>
  );
}
