import { useState } from "react";

type RegisterScreenProps = {
  registerAccount: (username: string, password: string, displayName: string) => Promise<boolean>;
  error: string | null;
  busyRegister: boolean;
  onRegisterSuccess: () => void;
  onShowLogin: () => void;
};

export default function RegisterScreen({
  registerAccount,
  error,
  busyRegister,
  onRegisterSuccess,
  onShowLogin,
}: Readonly<RegisterScreenProps>) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleSubmit = async () => {
    const ok = await registerAccount(username, password, displayName);
    if (ok) onRegisterSuccess();
  };

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">🎰</span>
          <h1 className="auth-title">Debug Tool</h1>
          <p className="auth-subtitle">Create a new account</p>
        </div>

        <div className="auth-fields">
          <label className="auth-field">
            <span className="auth-field-label">Username</span>
            <input
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={busyRegister}
              placeholder="Choose a username"
            />
          </label>
          <label className="auth-field">
            <span className="auth-field-label">Display name</span>
            <input
              className="auth-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              disabled={busyRegister}
              placeholder="Your display name"
            />
          </label>
          <label className="auth-field">
            <span className="auth-field-label">Password</span>
            <input
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              disabled={busyRegister}
              placeholder="Choose a password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busyRegister) void handleSubmit();
              }}
            />
          </label>
        </div>

        {error ? <p className="auth-notice auth-notice--error">{error}</p> : null}

        <button
          type="button"
          className="auth-btn"
          onClick={() => void handleSubmit()}
          disabled={busyRegister}
        >
          {busyRegister ? "Creating…" : "Create account"}
        </button>

        <p className="auth-switch">
          Already have an account?{" "}
          <button
            type="button"
            className="auth-switch-btn"
            onClick={onShowLogin}
            disabled={busyRegister}
          >
            Sign in
          </button>
        </p>
      </div>
    </main>
  );
}
