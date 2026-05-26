import JoinRetryModal from "./components/JoinRetryModal";
import { useGameSession } from "./hooks/useGameSession";
import GameScreen from "./screens/GameScreen";
import LoginScreen from "./screens/LoginScreen";
import "./slot-cabinet.css";
import "./App.css";

export default function App() {
  const session = useGameSession();

  return (
    <div className="game-app">
      {session.gameScreenActive ? (
        <GameScreen {...session} />
      ) : (
        <LoginScreen {...session} />
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
