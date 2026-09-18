import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

const COMPOSIO_API_BASE_URL = "https://backend.composio.dev/api/v3.1";
const COMPOSIO_REQUEST_TIMEOUT_MS = 20_000;

export interface ComposioEnvironment {
  COMPOSIO_API_KEY?: string;
  COMPOSIO_USER_NAMESPACE?: string;
}

export type ComposioHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export function requireComposioApiKey(env: ComposioEnvironment): string {
  const apiKey = env.COMPOSIO_API_KEY?.trim();

  if (!apiKey) {
    throw new AssistantError("Composio is not configured", ErrorType.CONFIGURATION_ERROR);
  }

  return apiKey;
}

function getErrorType(status: number): ErrorType {
  if (status === 401 || status === 403) {
    return ErrorType.AUTHORISATION_ERROR;
  }

  if (status === 404) {
    return ErrorType.NOT_FOUND;
  }

  if (status === 409) {
    return ErrorType.CONFLICT_ERROR;
  }

  if (status === 429) {
    return ErrorType.RATE_LIMIT_ERROR;
  }

  return ErrorType.EXTERNAL_API_ERROR;
}

export async function composioRequest<T>(params: {
  env: ComposioEnvironment;
  path: string;
  method?: ComposioHttpMethod;
  body?: Record<string, unknown>;
}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${COMPOSIO_API_BASE_URL}${params.path}`, {
      method: params.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": requireComposioApiKey(params.env),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
      signal: AbortSignal.timeout(COMPOSIO_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AssistantError(
      error instanceof DOMException && error.name === "TimeoutError"
        ? "Composio request timed out"
        : "Could not reach Composio",
      ErrorType.NETWORK_ERROR,
      502,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const upstreamError = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
    const requestId =
      upstreamError && typeof upstreamError.request_id === "string"
        ? upstreamError.request_id
        : undefined;

    if (upstreamError?.slug === "APIKey_InsufficientPermissions") {
      const permission =
        typeof upstreamError.message === "string"
          ? upstreamError.message.match(/requires "([a-z_]+)" write access/)?.[1]
          : undefined;

      throw new AssistantError(
        `Composio API key needs write access${permission ? ` for ${permission}` : " for this operation"}`,
        ErrorType.AUTHORISATION_ERROR,
        403,
        { requestId },
      );
    }

    throw new AssistantError(
      "Composio request failed",
      getErrorType(response.status),
      response.status === 429 ? 429 : response.status >= 500 ? 502 : response.status,
      { requestId },
    );
  }

  return payload as T;
}
