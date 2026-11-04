import type { ConnectorOAuthConfig } from "@ngriffin_uk/polychat-ai-integrations";
import {
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { fetchJson } from "@ngriffin_uk/polychat-utility-server/http";

import type { IEnv } from "~/types";

export interface ConnectorOAuthClient {
  clientId: string;
}

export interface ConnectorOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export function readConnectorOAuthClient(
  env: IEnv,
  config: ConnectorOAuthConfig,
): ConnectorOAuthClient | null {
  const clientId = readNonEmptyString(readRecord(env)[config.clientIdEnv]);

  return clientId ? { clientId } : null;
}

export function buildConnectorAuthorizationUrl(params: {
  config: ConnectorOAuthConfig;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(params.config.authorizeUrl);

  url.search = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  return url.toString();
}

export async function requestConnectorTokens(params: {
  config: ConnectorOAuthConfig;
  client: ConnectorOAuthClient;
  grant: Record<string, string>;
}): Promise<ConnectorOAuthTokens> {
  const payload = readRecord(
    await fetchJson(params.config.tokenUrl, {
      service: "Connector authorisation",
      headers: { "User-Agent": "Polychat" },
      body: { ...params.grant, client_id: params.client.clientId },
    }),
  );
  const accessToken = readNonEmptyString(payload.access_token);

  if (!accessToken) {
    throw new AssistantError(
      "The connector returned an unusable token",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const expiresIn = readFiniteNumber(payload.expires_in);
  const refreshToken = readNonEmptyString(payload.refresh_token);

  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(expiresIn ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() } : {}),
  };
}
