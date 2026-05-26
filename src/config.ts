const DEFAULT_API_BASE_URL =
  "https://agency001.relaxwmestu.xyz/api/v1";
const DEFAULT_WS_URL = "wss://gob02-ws.relaxwmestu.xyz/websocket";
const DEFAULT_GAME_ID = "game-the-last-guardian-of-angkor";

const DEFAULT_AUTH_REFRESH_INTERVAL_MS = 115_000;

export interface GameGuiEnvDefaults {
  apiBaseUrl: string;
  wsUrl: string;
  agentId: string;
  gameId: string;
  gameRoute: string;
  timeoutMs: number;
  authRefreshUrl: string;
  authRefreshIntervalMs: number;
}

export function readEnvDefaults(): GameGuiEnvDefaults {
  const timeoutRaw = import.meta.env.VITE_WS_TIMEOUT_MS;
  const timeoutParsed = timeoutRaw ? Number(timeoutRaw) : Number.NaN;
  const gameId =
    import.meta.env.VITE_GAME_ID ??
    import.meta.env.VITE_GAME_ROUTE ??
    DEFAULT_GAME_ID;
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
    wsUrl: import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL,
    agentId: import.meta.env.VITE_AGENT_ID ?? "1",
    gameId,
    gameRoute: gameId,
    timeoutMs:
      Number.isFinite(timeoutParsed) && timeoutParsed > 0
        ? timeoutParsed
        : 10_000,
    authRefreshUrl:
      import.meta.env.VITE_AUTH_REFRESH_URL ??
      "https://authentication.relaxwmestu.xyz/api/auth/refresh",
    authRefreshIntervalMs: (() => {
      const raw = import.meta.env.VITE_AUTH_REFRESH_INTERVAL_MS;
      const parsed = raw ? Number(raw) : Number.NaN;
      return Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_AUTH_REFRESH_INTERVAL_MS;
    })(),
  };
}
