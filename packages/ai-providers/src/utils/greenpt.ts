import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { CredentialAuthority } from "../api-keys.js";
import { resolveHostProviderApiKey } from "../credentials.js";
import type { ProviderEnv } from "../env.js";
import type { ProviderHost } from "../host.js";
import { formatProviderError } from "./errors.js";

export const GREENPT_PROVIDER_NAME = "greenpt";
export const GREENPT_API_KEY_ENV = "GREENPT_API_KEY";
export const GREENPT_API_BASE_URL = "https://api.greenpt.ai/v1";

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

export async function greenPtRequest<TResponse>(options: {
  apiKey: string;
  path: string;
  body: BodyInit;
  contentType?: string;
  authScheme?: GreenPtAuthScheme;
  label: string;
  signal?: AbortSignal;
}): Promise<TResponse> {
  const headers: Record<string, string> = {
    Authorization: buildGreenPtAuthorization(options.apiKey, options.authScheme),
  };

  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  }

  const response = await fetch(buildGreenPtUrl(options.path), {
    method: "POST",
    headers,
    body: options.body,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new AssistantError(
      await formatProviderError(response, `${options.label} failed`),
      ErrorType.EXTERNAL_API_ERROR,
      response.status,
    );
  }

  return (await response.json()) as TResponse;
}

export function greenPtJsonRequest<TResponse>(options: {
  apiKey: string;
  path: string;
  payload: Record<string, unknown>;
  label: string;
  signal?: AbortSignal;
}): Promise<TResponse> {
  return greenPtRequest<TResponse>({
    apiKey: options.apiKey,
    path: options.path,
    body: JSON.stringify(options.payload),
    contentType: "application/json",
    label: options.label,
    signal: options.signal,
  });
}
