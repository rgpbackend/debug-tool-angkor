import { useState } from "react";

type LoginScreenProps = {
  login: (username: string, password: string) => Promise<boolean>;
  error: string | null;
  authSuccessMessage: string | null;
  busySession: boolean;
  onShowRegister: () => void;
  onLoginSuccess: () => void;
};

export default function LoginScreen({
  login,
  error,
  authSuccessMessage,
  busySession,
  onShowRegister,
  onLoginSuccess,
}: Readonly<LoginScreenProps>) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    login(username, password).then((ok) => {
      if (ok) onLoginSuccess();
    });
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
                if (e.key === "Enter" && !busySession) handleSubmit();
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
            {busySession ? "Signing in…" : "Login"}
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
      </div>
    </main>
  );
}
