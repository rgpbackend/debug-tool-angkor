import { useState } from "react";
import JoinRetryModal from "./components/JoinRetryModal";
import { useGameSession } from "./hooks/useGameSession";
import GameScreen from "./screens/GameScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import "./slot-cabinet.css";
import "./App.css";

type AuthView = "login" | "register";

export default function App() {
  const session = useGameSession();
  const [authView, setAuthView] = useState<AuthView>("login");

  const showLogin = () => {
    session.setError(null);
    setAuthView("login");
  };

  const showRegister = () => {
    session.setError(null);
    session.setAuthSuccessMessage(null);
    setAuthView("register");
  };

  const handleRegisterSuccess = () => {
    setAuthView("login");
  };

  return (
    <div className="game-app">
      {session.gameScreenActive ? (
        <GameScreen {...session} />
      ) : authView === "register" ? (
        <RegisterScreen
          {...session}
          onShowLogin={showLogin}
          onRegisterSuccess={handleRegisterSuccess}
        />
      ) : (
        <LoginScreen {...session} onShowRegister={showRegister} />
      )}

      <JoinRetryModal
        open={session.joinRetryOpen}
        message={session.joinRetryMessage ?? ""}
        busy={session.joinRetryBusy}
        onRetry={session.retryJoinGame}
        onLogout={session.dismissJoinRetry}
      />
    </div>
  );
}
