export async function resetAccessToken(
  baseUrl: string,
  token: string,
): Promise<void> {
  const trimmedBase = baseUrl.trim().replace(/\/$/, "");
  const trimmedToken = token.trim();
  if (!trimmedBase) {
    throw new Error("Token reset API base URL is not configured");
  }
  if (!trimmedToken) {
    throw new Error("Access token is required to reset");
  }

  const url = new URL(`${trimmedBase}/token/reset-tokens`);
  url.searchParams.set("token", trimmedToken);

  const response = await fetch(url.toString(), { method: "POST" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Reset token failed (${response.status})${body ? `: ${body}` : ""}`,
    );
  }
}
