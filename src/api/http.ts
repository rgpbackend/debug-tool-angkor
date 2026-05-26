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

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid API response: response body is not valid JSON");
  }
}
