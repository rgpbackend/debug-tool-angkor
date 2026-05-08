/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  readonly VITE_AGENT_ID?: string;
  readonly VITE_ACCESS_TOKEN?: string;
  readonly VITE_GAME_ROUTE?: string;
  readonly VITE_WS_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
