import TokenBannedModal from "./components/TokenBannedModal";
import { useGameSession } from "./hooks/useGameSession";
import GameScreen from "./screens/GameScreen";
import LoginScreen from "./screens/LoginScreen";
import "./slot-cabinet.css";
import "./App.css";

export default function App() {
  const session = useGameSession();

  return (
    <div className="game-app">
      {session.sessionReady ? (
        <GameScreen {...session} />
      ) : (
        <LoginScreen {...session} />
      )}

      <TokenBannedModal
        open={session.tokenBanPromptOpen}
        tokenPreview={session.accessToken.trim() || "—"}
        busy={session.tokenResetBusy}
        onConfirm={() => void session.confirmTokenReset()}
        onCancel={session.dismissTokenBanPrompt}
      />
    </div>
  );
}
