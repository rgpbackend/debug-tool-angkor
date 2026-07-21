import { getGames, type GameDef } from "../games";

type LobbyScreenProps = {
  loggedIn: boolean;
  error: string | null;
  busy: boolean;
  onLaunch: (game: GameDef) => void;
  onLogout: () => void;
};

export default function LobbyScreen({
  loggedIn,
  error,
  busy,
  onLaunch,
  onLogout,
}: Readonly<LobbyScreenProps>) {
  const games = getGames();
  const empty = !busy && games.length === 0;

  return (
    <main className="login-screen">
      <div className="panel lobby-panel">
        <div className="lobby-header">
          <h2>Select Game</h2>
          <button type="button" className="logout-btn" onClick={onLogout}>
            Log out
          </button>
        </div>

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

        {error ? <p className="error">{error}</p> : null}

        {busy ? (
          <p className="muted login-phase">
            Launching game…
          </p>
        ) : null}
      </div>
    </main>
  );
}
