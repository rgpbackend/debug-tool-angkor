type SlotConsoleBalanceProps = {
  balance: string | null;
  connected: boolean;
};

export default function SlotConsoleBalance({
  balance,
  connected,
}: Readonly<SlotConsoleBalanceProps>) {
  const display =
    !connected || balance == null ? "—" : formatBalance(balance);

  return (
    <div className="slot-console-balance" role="group" aria-label="Player balance">
      <span className="slot-console-balance-label">Balance</span>
      <span className="slot-console-balance-value">{display}</span>
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
