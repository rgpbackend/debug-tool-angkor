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
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">🎰</span>
          <h1 className="auth-title">Debug Tool</h1>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        <div className="auth-fields">
          <label className="auth-field">
            <span className="auth-field-label">Username</span>
            <input
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={busySession}
              placeholder="Enter your username"
            />
          </label>
          <label className="auth-field">
            <span className="auth-field-label">Password</span>
            <input
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              disabled={busySession}
              placeholder="Enter your password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busySession) handleSubmit();
              }}
            />
          </label>
        </div>

        {authSuccessMessage ? (
          <p className="auth-notice auth-notice--success" role="status">
            {authSuccessMessage}
          </p>
        ) : null}

        {error ? <p className="auth-notice auth-notice--error">{error}</p> : null}

        <button
          type="button"
          className="auth-btn"
          onClick={handleSubmit}
          disabled={busySession}
        >
          {busySession ? "Signing in…" : "Sign in"}
        </button>

        <p className="auth-switch">
          No account yet?{" "}
          <button
            type="button"
            className="auth-switch-btn"
            onClick={onShowRegister}
            disabled={busySession}
          >
            Create one
          </button>
        </p>
      </div>
    </main>
  );
}
