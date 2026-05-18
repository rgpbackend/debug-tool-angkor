import type { GameSession } from "../hooks/useGameSession";

type LoginScreenProps = Pick<
  GameSession,
  | "wsUrl"
  | "setWsUrl"
  | "agentId"
  | "setAgentId"
  | "accessToken"
  | "setAccessToken"
  | "gameRoute"
  | "setGameRoute"
  | "connectAndJoin"
  | "error"
  | "busyConnect"
  | "phase"
>;

export default function LoginScreen({
  wsUrl,
  setWsUrl,
  agentId,
  setAgentId,
  accessToken,
  setAccessToken,
  gameRoute,
  setGameRoute,
  connectAndJoin,
  error,
  busyConnect,
  phase,
}: Readonly<LoginScreenProps>) {
  return (
    <main className="login-screen">
      <div className="login-card panel">
        <h2>Connect to game</h2>
        <p className="muted login-lead">
          Enter WebSocket credentials and join the game session.
        </p>

        <div className="field-grid login-fields">
          <label className="span-2">
            WebSocket URL
            <input
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="wss://…/websocket"
              autoComplete="off"
              disabled={busyConnect}
            />
          </label>
          <label>
            Agent ID
            <input
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={busyConnect}
            />
          </label>
          <label>
            Game route
            <input
              value={gameRoute}
              onChange={(e) => setGameRoute(e.target.value)}
              disabled={busyConnect}
            />
          </label>
          <label className="span-2">
            Access token
            <input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              type="text"
              autoComplete="off"
              disabled={busyConnect}
            />
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div className="row login-actions">
          <button
            type="button"
            className="primary"
            onClick={() => void connectAndJoin()}
            disabled={busyConnect}
          >
            {busyConnect ? "Connecting…" : "Connect + join"}
          </button>
        </div>

        {busyConnect ? (
          <p className="muted login-phase">
            Phase: <strong>{phase}</strong>
          </p>
        ) : null}
      </div>
    </main>
  );
}
