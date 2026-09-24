import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  readResponseTextWithinLimit,
  ResponseBodyTooLargeError,
} from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { CredentialAuthority } from "../api-keys.js";
import { resolveHostProviderApiKey } from "../credentials.js";
import type { ProviderEnv } from "../env.js";
import type { ProviderHost } from "../host.js";

export const GREENPT_PROVIDER_NAME = "greenpt";
export const GREENPT_API_KEY_ENV = "GREENPT_API_KEY";
export const GREENPT_API_BASE_URL = "https://api.greenpt.ai/v1";
const GREENPT_REQUEST_TIMEOUT_MS = 100_000;
const MAX_GREENPT_ERROR_BYTES = 64 * 1024;
const MAX_GREENPT_RESPONSE_BYTES = 20 * 1024 * 1024;

export type GreenPtAuthScheme = "Bearer" | "Token";

export function resolveGreenPtApiKey(
  host: ProviderHost,
  options: { env: ProviderEnv; userId?: number; credentialAuthority?: CredentialAuthority },
): Promise<string> {
  return resolveHostProviderApiKey(host, {
    env: options.env,
    providerName: GREENPT_PROVIDER_NAME,
    envKeyName: GREENPT_API_KEY_ENV,
    userId: options.userId,
    credentialAuthority: options.credentialAuthority,
  });
}

export function buildGreenPtAuthorization(apiKey: string, scheme: GreenPtAuthScheme = "Bearer") {
  return `${scheme} ${apiKey}`;
}

export function buildGreenPtUrl(path: string): URL {
  return new URL(`${GREENPT_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
}

export async function greenPtRequest(options: {
  apiKey: string;
  path: string;
  body: BodyInit;
  contentType?: string;
  authScheme?: GreenPtAuthScheme;
  label: string;
  signal?: AbortSignal;
  maxResponseBytes?: number;
}): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: buildGreenPtAuthorization(options.apiKey, options.authScheme),
  };

  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  }

  const controller = new AbortController();
  const abortRequest = () => controller.abort(options.signal?.reason);
  const timeout = setTimeout(() => controller.abort(), GREENPT_REQUEST_TIMEOUT_MS);

  if (options.signal?.aborted) {
    abortRequest();
  } else {
    options.signal?.addEventListener("abort", abortRequest, { once: true });
  }

  try {
    const response = await fetch(buildGreenPtUrl(options.path), {
      method: "POST",
      headers,
      body: options.body,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`.trim();

      try {
        const body = await readResponseTextWithinLimit(response, MAX_GREENPT_ERROR_BYTES);

        if (body) {
          detail = `${detail} - ${redactSensitiveTokens(body)}`;
        }
      } catch (error) {
        if (!(error instanceof ResponseBodyTooLargeError)) {
          throw error;
        }
      }

      throw new AssistantError(
        `${options.label} failed${detail ? `: ${detail}` : ""}`,
        ErrorType.EXTERNAL_API_ERROR,
        response.status,
      );
    }

    let responseText: string;

    try {
      responseText = await readResponseTextWithinLimit(
        response,
        options.maxResponseBytes ?? MAX_GREENPT_RESPONSE_BYTES,
      );
    } catch (error) {
      if (error instanceof ResponseBodyTooLargeError) {
        throw new AssistantError(
          `${options.label} returned a response larger than the configured limit`,
          ErrorType.PROVIDER_ERROR,
          502,
        );
      }

      throw error;
    }

    const body = safeParseJson<unknown>(responseText);

    if (body === null && responseText.trim() !== "null") {
      throw new AssistantError(
        `${options.label} returned invalid JSON`,
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return body;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortRequest);
  }
}

export function greenPtJsonRequest(options: {
  apiKey: string;
  path: string;
  payload: Record<string, unknown>;
  label: string;
  signal?: AbortSignal;
}): Promise<unknown> {
  return greenPtRequest({
    apiKey: options.apiKey,
    path: options.path,
    body: JSON.stringify(options.payload),
    contentType: "application/json",
    label: options.label,
    signal: options.signal,
  });
}
