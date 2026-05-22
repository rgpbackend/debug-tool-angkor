import { readEnvDefaults } from "../config";

export interface RefreshSessionRequest {
  refreshToken: string;
}

export interface RefreshSessionResponse {
  token: string;
  refreshToken?: string;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid API response: missing ${field}`);
  }
  return value.trim();
}

/** Exchange stored refresh token for a new WS access token (token2). */
export async function refreshSessionToken(
  refreshToken: string,
): Promise<{ token: string; refreshToken: string }> {
  const url = readEnvDefaults().authRefreshUrl.trim();
  if (!url) {
    throw new Error("Auth refresh URL is not configured");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken } satisfies RefreshSessionRequest),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Refresh failed (${response.status})${text ? `: ${text}` : ""}`,
    );
  }

  const data = (await response.json()) as RefreshSessionResponse;
  const token = requireNonEmptyString(data.token, "token");
  const nextRefresh =
    typeof data.refreshToken === "string" && data.refreshToken.trim()
      ? data.refreshToken.trim()
      : refreshToken.trim();

  return { token, refreshToken: nextRefresh };
}
