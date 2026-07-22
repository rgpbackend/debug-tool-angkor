import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { getGames, type GameDef } from "./games";
import { loadAgencyUserToken, loadLaunchedGameId, loadRefreshToken } from "./lib/game-session-storage";
import LobbyScreen from "./screens/LobbyScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import "./App.css";

type AppView = "login" | "register" | "lobby" | "game";

export default function App() {
  const auth = useAuth();
  const [view, setView] = useState<AppView>(() => {
    if (loadAgencyUserToken()) return "lobby";
    return "login";
  });
  const [selectedGame, setSelectedGame] = useState<GameDef | null>(null);
  const [wsAccessToken, setWsAccessToken] = useState("");

  // Auto-resume from refresh token on page load
  useEffect(() => {
    const rt = loadRefreshToken();
    const gid = loadLaunchedGameId();
    if (!rt || !gid) return;
    if (view === "game") return;

    auth.refreshAndGetToken().then((result) => {
      if (result) {
        const game = getGames().find((g) => g.id === result.gameId);
        if (game) {
          setSelectedGame(game);
          setWsAccessToken(result.accessToken);
          setView("game");
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = useCallback(() => setView("lobby"), []);
  const handleRegisterSuccess = useCallback(() => setView("login"), []);

  const handleLaunchGame = useCallback(async (game: GameDef) => {
    const result = await auth.playGame(game.id);
    if (result) {
      setSelectedGame(game);
      setWsAccessToken(result.token);
      setView("game");
    }
  }, [auth]);

  const handleBackToLobby = useCallback(() => {
    setWsAccessToken("");
    setSelectedGame(null);
    setView("lobby");
  }, []);

  const handleLogout = useCallback(() => {
    auth.logout();
    setWsAccessToken("");
    setSelectedGame(null);
    setView("login");
  }, [auth]);

  const GameScreenComponent = selectedGame?.GameScreen;

  return (
    <div className="game-app">
      {view === "game" && GameScreenComponent && wsAccessToken ? (
        <GameScreenComponent
          agencyUserToken={auth.agencyUserToken}
          wsAccessToken={wsAccessToken}
          balance={null}
          depositBusy={auth.depositBusy}
          depositFunds={auth.deposit}
          onBackToLobby={handleBackToLobby}
          onLogout={handleLogout}
        />
      ) : view === "lobby" ? (
        <LobbyScreen
          loggedIn={auth.agencyUserToken !== ""}
          error={auth.error}
          busy={auth.busy}
          onLaunch={handleLaunchGame}
          onLogout={handleLogout}
        />
      ) : view === "register" ? (
        <RegisterScreen
          registerAccount={auth.register}
          error={auth.error}
          busyRegister={auth.busy}
          onRegisterSuccess={handleRegisterSuccess}
          onShowLogin={() => {
            auth.setError(null);
            auth.setAuthSuccessMessage(null);
            setView("login");
          }}
        />
      ) : (
        <LoginScreen
          login={auth.login}
          error={auth.error}
          authSuccessMessage={auth.authSuccessMessage}
          busySession={auth.busy}
          onShowRegister={() => {
            auth.setError(null);
            auth.setAuthSuccessMessage(null);
            setView("register");
          }}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
