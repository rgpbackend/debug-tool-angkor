export interface GameGuiEnvDefaults {
  wsUrl: string;
  agentId: string;
  accessToken: string;
  gameRoute: string;
  timeoutMs: number;
}

export function readEnvDefaults(): GameGuiEnvDefaults {
  const timeoutRaw = import.meta.env.VITE_WS_TIMEOUT_MS;
  const timeoutParsed = timeoutRaw ? Number(timeoutRaw) : Number.NaN;
  return {
    wsUrl: import.meta.env.VITE_WS_URL ?? "",
    agentId: import.meta.env.VITE_AGENT_ID ?? "1",
    accessToken: import.meta.env.VITE_ACCESS_TOKEN ?? "",
    gameRoute: import.meta.env.VITE_GAME_ROUTE ?? "game-the-last-guardian-of-angkor",
    timeoutMs: Number.isFinite(timeoutParsed) && timeoutParsed > 0 ? timeoutParsed : 10_000,
  };
}
