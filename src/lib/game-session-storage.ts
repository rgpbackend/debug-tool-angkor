const REFRESH_TOKEN_KEY = "angkor.gui.refreshToken";

/** Legacy keys from earlier builds — removed on read/clear. */
const LEGACY_KEYS = ["angkor.gui.gameToken", "angkor.gui.gameId"] as const;

function removeLegacyKeys(): void {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

export function saveRefreshToken(refreshToken: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  removeLegacyKeys();
}

export function loadRefreshToken(): string | null {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)?.trim();
  if (!refreshToken) {
    return null;
  }
  removeLegacyKeys();
  return refreshToken;
}

export function clearGameSession(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  removeLegacyKeys();
}
