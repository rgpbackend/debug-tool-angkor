import type { GameSession } from "../hooks/useGameSession";
import { useState } from "react";

type LoginScreenProps = Pick<
  GameSession,
  | "loginAndEnterGame"
  | "error"
  | "authSuccessMessage"
  | "busySession"
  | "phase"
> & {
  onShowRegister: () => void;
};

function loginButtonLabel(phase: GameSession["phase"], busy: boolean): string {
  if (!busy) {
    return "Login";
  }
  switch (phase) {
    case "logging-in":
      return "Signing in…";
    case "launching":
      return "Launching game…";
    case "refreshing":
      return "Refreshing session…";
    case "connecting":
    case "connected":
      return "Connecting…";
    default:
      return "Please wait…";
  }
}

export default function LoginScreen({
  loginAndEnterGame,
  error,
  authSuccessMessage,
  busySession,
  phase,
  onShowRegister,
}: Readonly<LoginScreenProps>) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    void loginAndEnterGame(username, password);
  };

  return (
    <main className="login-screen">
      <div className="login-card panel">
        <h2>Sign in</h2>
        <p className="muted login-lead">
          Sign in with your account to launch the game and connect.
        </p>

        <div className="field-grid login-fields">
          <label className="span-2">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={busySession}
            />
          </label>
          <label className="span-2">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              disabled={busySession}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busySession) {
                  handleSubmit();
                }
              }}
            />
          </label>
        </div>

        {authSuccessMessage ? (
          <p className="success auth-notice" role="status">
            {authSuccessMessage}
          </p>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <div className="row login-actions">
          <button
            type="button"
            className="primary"
            onClick={handleSubmit}
            disabled={busySession}
          >
            {loginButtonLabel(phase, busySession)}
          </button>
        </div>

        <p className="auth-switch muted">
          No account yet?{" "}
          <button
            type="button"
            className="link-button"
            onClick={onShowRegister}
            disabled={busySession}
          >
            Register
          </button>
        </p>

        {busySession ? (
          <p className="muted login-phase">
            Phase: <strong>{phase}</strong>
          </p>
        ) : null}
      </div>
    </main>
  );
}
