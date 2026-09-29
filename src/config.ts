const DEFAULT_API_BASE_URL =
  "https://agency001.relaxwmestu.xyz/api/v1";
const DEFAULT_WS_URL = "wss://gob02-ws.relaxwmestu.xyz/websocket";
const DEFAULT_AUTH_REFRESH_INTERVAL_MS = 115_000;

export interface AppEnvDefaults {
  apiBaseUrl: string;
  wsUrl: string;
  /** Spin / WS response timeout in ms. */
  timeoutMs: number;
  authRefreshUrl: string;
  authRefreshIntervalMs: number;
}

function defaultApiBaseUrl(): string {
  if (import.meta.env.VITE_API_AUTH_URL) {
    return import.meta.env.VITE_API_AUTH_URL;
  }
  if (import.meta.env.DEV) {
    return "/agency-api";
  }
  return DEFAULT_API_BASE_URL;
}

function defaultAuthRefreshUrl(): string {
  if (import.meta.env.VITE_AUTH_REFRESH_URL) {
    return import.meta.env.VITE_AUTH_REFRESH_URL;
  }
  if (import.meta.env.DEV) {
    return "/auth-refresh";
  }
  return "https://authentication.relaxwmestu.xyz/api/auth/refresh";
}

export function readEnvDefaults(): AppEnvDefaults {
  const timeoutRaw = import.meta.env.VITE_WS_TIMEOUT_MS;
  const timeoutParsed = timeoutRaw ? Number(timeoutRaw) : Number.NaN;
  return {
    apiBaseUrl: defaultApiBaseUrl(),
    wsUrl: import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL,
    timeoutMs:
      Number.isFinite(timeoutParsed) && timeoutParsed > 0
        ? timeoutParsed
        : 10_000,
    authRefreshUrl: defaultAuthRefreshUrl(),
    authRefreshIntervalMs: (() => {
      const raw = import.meta.env.VITE_AUTH_REFRESH_INTERVAL_MS;
      const parsed = raw ? Number(raw) : Number.NaN;
      return Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_AUTH_REFRESH_INTERVAL_MS;
    })(),
  };
}
