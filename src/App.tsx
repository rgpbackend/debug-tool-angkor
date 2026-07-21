import { useState } from "react";
import JoinRetryModal from "./components/JoinRetryModal";
import { useGameSession } from "./hooks/useGameSession";
import { type GameDef } from "./games";
import GameScreen from "./screens/GameScreen";
import LobbyScreen from "./screens/LobbyScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import "./slot-cabinet.css";
import "./App.css";

type AppView = "login" | "register" | "lobby" | "game";

export default function App() {
  const session = useGameSession();
  const [view, setView] = useState<AppView>("login");

  const handleLoginSuccess = () => setView("lobby");

  const handleLaunchGame = (game: GameDef) => {
    session.launchGame(game).then((ok) => {
      if (ok) setView("game");
    });
  };

  const handleBackToLobby = () => {
    session.disconnect();
    setView("lobby");
  };

  const handleLogout = () => {
    session.logout();
    setView("login");
  };

  const handleRegisterSuccess = () => setView("login");

  return (
    <div className="game-app">
      {view === "game" ? (
        <GameScreen
          {...session}
          onBackToLobby={handleBackToLobby}
          onLogout={handleLogout}
        />
      ) : view === "lobby" ? (
        <LobbyScreen
          loggedIn={session.agencyUserToken !== ""}
          error={session.error}
          busy={session.phase === "launching"}
          onLaunch={handleLaunchGame}
          onLogout={handleLogout}
        />
      ) : view === "register" ? (
        <RegisterScreen
          {...session}
          onShowLogin={() => {
            session.setError(null);
            setView("login");
          }}
          onRegisterSuccess={handleRegisterSuccess}
        />
      ) : (
        <LoginScreen
          {...session}
          onShowRegister={() => {
            session.setError(null);
            session.setAuthSuccessMessage(null);
            setView("register");
          }}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      <JoinRetryModal
        open={session.joinRetryOpen}
        message={session.joinRetryMessage ?? ""}
        busy={session.joinRetryBusy}
        onRetry={session.retryJoinGame}
        onLogout={() => {
          session.dismissJoinRetry();
          setView("login");
        }}
      />
    </div>
  );
}
