import type { GameSession } from "../hooks/useGameSession";
import { useState } from "react";

type RegisterScreenProps = Pick<
  GameSession,
  "registerAccount" | "error" | "busyRegister" | "phase"
> & {
  onRegisterSuccess: () => void;
  onShowLogin: () => void;
};

export default function RegisterScreen({
  registerAccount,
  error,
  busyRegister,
  phase,
  onRegisterSuccess,
  onShowLogin,
}: Readonly<RegisterScreenProps>) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleSubmit = async () => {
    const ok = await registerAccount(username, password, displayName);
    if (ok) {
      onRegisterSuccess();
    }
  };

  return (
    <main className="login-screen">
      <div className="login-card panel">
        <h2>Create account</h2>
        <p className="muted login-lead">
          Register a new account. After success you can sign in on the login
          page.
        </p>

        <div className="field-grid login-fields">
          <label className="span-2">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={busyRegister}
            />
          </label>
          <label className="span-2">
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              disabled={busyRegister}
            />
          </label>
          <label className="span-2">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              disabled={busyRegister}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busyRegister) {
                  void handleSubmit();
                }
              }}
            />
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div className="row login-actions">
          <button
            type="button"
            className="primary"
            onClick={() => void handleSubmit()}
            disabled={busyRegister}
          >
            {busyRegister ? "Creating account…" : "Create account"}
          </button>
        </div>

        <p className="auth-switch muted">
          Already have an account?{" "}
          <button
            type="button"
            className="link-button"
            onClick={onShowLogin}
            disabled={busyRegister}
          >
            Sign in
          </button>
        </p>

        {busyRegister ? (
          <p className="muted login-phase">
            Phase: <strong>{phase}</strong>
          </p>
        ) : null}
      </div>
    </main>
  );
}
