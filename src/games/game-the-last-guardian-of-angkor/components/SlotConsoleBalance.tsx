type SlotConsoleBalanceProps = {
  balance: string | null;
  connected: boolean;
  canDeposit?: boolean;
  depositBusy?: boolean;
  onDeposit?: () => void;
};

export default function SlotConsoleBalance({
  balance,
  connected,
  canDeposit = false,
  depositBusy = false,
  onDeposit,
}: Readonly<SlotConsoleBalanceProps>) {
  const display =
    !connected || balance == null ? "—" : formatBalance(balance);

  return (
    <div className="slot-console-balance" role="group" aria-label="Player balance">
      <span className="slot-console-balance-label">Balance</span>
      <div className="slot-console-balance-row">
        <span className="slot-console-balance-value">{display}</span>
        {onDeposit ? (
          <button
            type="button"
            className="slot-console-deposit-btn"
            onClick={() => void onDeposit()}
            disabled={!canDeposit || depositBusy}
            aria-label="Deposit 1,000"
            title={
              canDeposit
                ? "Deposit 1,000"
                : "Deposit available when balance is below 10,000"
            }
          >
            {depositBusy ? "…" : "+"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function formatBalance(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return value;
  }
  if (Number.isInteger(n)) {
    return n.toLocaleString();
  }
  const decimals = value.includes(".") ? (value.split(".")[1]?.length ?? 2) : 2;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(decimals, 4),
    maximumFractionDigits: 4,
  });
}
