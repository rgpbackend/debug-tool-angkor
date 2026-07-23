import { useState } from "react";
import { getGames, type GameDef } from "../games";

type LobbyScreenProps = {
  loggedIn: boolean;
  error: string | null;
  busy: boolean;
  depositBusy: boolean;
  onDeposit: (amount: number) => Promise<void>;
  onLaunch: (game: GameDef) => void;
  onLogout: () => void;
};

const QUICK_DEPOSIT_OPTIONS = [100, 500, 1000, 5000, 10000];

export default function LobbyScreen({
  loggedIn,
  error,
  busy,
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

  return (
    <main className="lobby-screen">
      <header className="lobby-topbar">
        <span className="lobby-brand">Game Hub</span>
        <button type="button" className="logout-btn" onClick={onLogout}>
          Log out
        </button>
      </header>

      <section className="lobby-wallet">
        <div className="wallet-deposit">
          <label className="wallet-label">Deposit Funds</label>
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
              className="deposit-btn primary"
              disabled={depositBusy || !loggedIn}
              onClick={handleDeposit}
            >
              {depositBusy ? "Depositing…" : depositOk ? "✓ Done" : "Deposit"}
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

      {error ? <p className="error">{error}</p> : null}

      {depositOk ? (
        <p className="deposit-success">Deposit successful.</p>
      ) : null}

      <section className="lobby-games-section">
        <h2 className="lobby-section-title">Select Game</h2>

        {empty ? (
          <p className="muted">No games configured.</p>
        ) : (
          <div className="lobby-grid">
            {games.map((game) => (
              <button
                key={game.id}
                type="button"
                className="lobby-game-card primary"
                disabled={busy || !loggedIn}
                onClick={() => onLaunch(game)}
              >
                <span className="lobby-game-icon">{game.icon}</span>
                <span className="lobby-game-name">{game.name}</span>
              </button>
            ))}
          </div>
        )}

        {busy ? (
          <p className="muted login-phase">Launching game…</p>
        ) : null}
      </section>
    </main>
  );
}
