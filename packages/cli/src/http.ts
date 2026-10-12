import { getErrorMessage, safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import { CliError } from "./errors.js";

export type Fetch = typeof fetch;

export interface JsonResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

export async function requestJson(
  fetchImpl: Fetch,
  url: string,
  init: { method: "GET" | "POST"; body?: unknown; apiKey?: string },
): Promise<JsonResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (init.apiKey) {
    headers.Authorization = `Bearer ${init.apiKey}`;
  }

  let response: Response;

  try {
    response = await fetchImpl(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (cause) {
    throw new CliError(
      `Could not reach ${new URL(url).origin}: ${getErrorMessage(cause, "network error")}`,
    );
  }

  const body = safeParseJson<unknown>(await response.text());

  return { ok: response.ok, status: response.status, body };
}
