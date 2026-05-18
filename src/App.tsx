import { useGameSession } from "./hooks/useGameSession";
import GameScreen from "./screens/GameScreen";
import LoginScreen from "./screens/LoginScreen";
import "./slot-cabinet.css";
import "./App.css";

export default function App() {
  const session = useGameSession();

  return (
    <div className="game-app">
      <header className="game-header">
        <h1>The Last Guardian of Angkor</h1>
        <p className="game-sub">WebSocket test client</p>
      </header>

      {session.sessionReady ? (
        <GameScreen {...session} />
      ) : (
        <LoginScreen {...session} />
      )}
    </div>
  );
}
