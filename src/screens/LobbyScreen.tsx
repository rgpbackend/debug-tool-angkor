import { useState } from "react";
import { getGames, type GameDef } from "../games";

type LobbyScreenProps = {
  loggedIn: boolean;
  error: string | null;
  busy: boolean;
  balance: number | null;
  balanceLoading: boolean;
  depositBusy: boolean;
  onDeposit: (amount: number) => Promise<void>;
  onLaunch: (game: GameDef) => void;
  onLogout: () => void;
};

const QUICK_DEPOSIT_OPTIONS = [100, 500, 1000, 5000, 10000];

function lobbyCardTheme(id: string): string {
  if (id === "yama_01021") return "titan";
  if (id === "yama_01026") return "bullet";
  return "angkor";
}

export default function LobbyScreen({
  loggedIn,
  error,
  busy,
  balance,
  balanceLoading,
  depositBusy,
  onDeposit,
  onLaunch,
  onLogout,
}: Readonly<LobbyScreenProps>) {
  const games = getGames();
  const empty = !busy && games.length === 0;
  const [depositAmount, setDepositAmount] = useState("1000");
  const [depositOk, setDepositOk] = useState(false);

  const handleDeposit = async () => {
    const n = Number(depositAmount);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await onDeposit(n);
      setDepositOk(true);
      window.setTimeout(() => setDepositOk(false), 2000);
    } catch {
      // error shown from parent
    }
  };

  const formatBalance = (n: number | null) => {
    if (n == null) return "$0.0000";
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  };

  return (
    <main className="lobby-screen">
      <header className="lobby-topbar">
        <div className="lobby-brand">
          <span className="lobby-brand-icon">🎰</span>
          <span className="lobby-brand-text">Game Hub</span>
        </div>
        <button type="button" className="lobby-logout-btn" onClick={onLogout}>
          Log out
        </button>
      </header>

      <section className="lobby-wallet">
        <div className="wallet-balance">
          <span className="wallet-label">Balance</span>
          <span className="wallet-balance-value">
            {balanceLoading ? "…" : formatBalance(balance)}
          </span>
        </div>

        <div className="wallet-deposit">
          <span className="wallet-label">Add Funds</span>
          <div className="deposit-input-row">
            <span className="deposit-currency">$</span>
            <input
              className="deposit-amount-input"
              type="number"
              min={1}
              step={1}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              disabled={depositBusy}
              placeholder="Amount"
            />
            <button
              type="button"
              className="deposit-btn"
              disabled={depositBusy || !loggedIn}
              onClick={handleDeposit}
            >
              {depositBusy ? "…" : depositOk ? "✓" : "Deposit"}
            </button>
          </div>
          <div className="deposit-quick">
            {QUICK_DEPOSIT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className="deposit-chip"
                disabled={depositBusy}
                onClick={() => setDepositAmount(String(n))}
              >
                ${n.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <p className="lobby-error">{error}</p> : null}
      {depositOk ? <p className="lobby-success">Funds added.</p> : null}

      <section className="lobby-games-section">
        <h2 className="lobby-section-title">Select Game</h2>

        {empty ? (
          <p className="lobby-empty">No games configured.</p>
        ) : (
          <div className="lobby-grid">
            {games.map((game) => (
              <button
                key={game.id}
                type="button"
                className={`lobby-game-card lobby-game-card--${lobbyCardTheme(game.id)}`}
                disabled={busy || !loggedIn}
                onClick={() => onLaunch(game)}
              >
                <span className="lobby-game-icon">{game.icon}</span>
                <span className="lobby-game-name">{game.name}</span>
                <span className="lobby-game-meta">
                  {game.id === "yama_01026"
                    ? "576 Ways"
                    : game.winSystem === "paylines"
                      ? "10 Paylines"
                      : "Win Ways"}
                </span>
              </button>
            ))}
          </div>
        )}

        {busy ? <p className="lobby-launching">Launching…</p> : null}
      </section>
    </main>
  );
}
