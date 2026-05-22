/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_AGENT_ID?: string;
  readonly VITE_GAME_ID?: string;
  readonly VITE_GAME_ROUTE?: string;
  readonly VITE_WS_TIMEOUT_MS?: string;
  readonly VITE_AUTH_REFRESH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
