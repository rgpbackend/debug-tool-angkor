import { readEnvDefaults } from "../config";

export interface PostJsonOptions {
  bearer?: string;
}

function trimTrailingSlash(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export async function postJson<T>(
  path: string,
  body: unknown,
  options?: PostJsonOptions,
): Promise<T> {
  const baseUrl = trimTrailingSlash(readEnvDefaults().apiBaseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const bearer = options?.bearer?.trim();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Request failed (${response.status})${text ? `: ${text}` : ""}`,
    );
  }

  return (await response.json()) as T;
}
