import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { McpRequestError } from "../errors.js";
import {
  clientRegistrationResponseSchema,
  tokenResponseSchema,
  type McpAuthorizationServer,
  type McpOAuthClient,
  type McpOAuthTokens,
} from "./metadata.js";

const OAUTH_TIMEOUT_MS = 15_000;
const MAX_OAUTH_RESPONSE_BYTES = 100_000;

async function postOAuth(params: {
  url: string;
  body: string;
  contentType: string;
  operation: string;
  fetch: typeof globalThis.fetch;
}): Promise<unknown> {
  let response: Response;

  try {
    response = await params.fetch(params.url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
      headers: { "Content-Type": params.contentType, Accept: "application/json" },
      body: params.body,
    });
  } catch {
    throw new McpRequestError({
      code: "network_error",
      operation: params.operation,
      message: "The MCP server's sign-in service could not be reached.",
      requestSent: false,
    });
  }

  const body = safeParseJson(await readResponseTextWithinLimit(response, MAX_OAUTH_RESPONSE_BYTES));

  if (!response.ok) {
    throw new McpRequestError({
      code: response.status === 400 || response.status === 401 ? "unauthorised" : "http_error",
      operation: params.operation,
      status: response.status,
      message: "The MCP server's sign-in service refused the request. Try connecting again.",
      requestSent: true,
    });
  }

  return body;
}

function toTokens(value: unknown, operation: string, now: number): McpOAuthTokens {
  const parsed = tokenResponseSchema.safeParse(value);

  if (!parsed.success) {
    throw new McpRequestError({
      code: "invalid_response",
      operation,
      message: "The MCP server's sign-in service returned an unreadable token.",
      requestSent: true,
    });
  }

  return {
    accessToken: parsed.data.access_token,
    tokenType: parsed.data.token_type,
    ...(parsed.data.refresh_token ? { refreshToken: parsed.data.refresh_token } : {}),
    ...(parsed.data.expires_in
      ? { expiresAt: new Date(now + parsed.data.expires_in * 1000).toISOString() }
      : {}),
  };
}

function clientParameters(client: McpOAuthClient): Record<string, string> {
  return {
    client_id: client.clientId,
    ...(client.clientSecret ? { client_secret: client.clientSecret } : {}),
  };
}

export async function registerMcpOAuthClient(params: {
  server: McpAuthorizationServer;
  redirectUri: string;
  clientName: string;
  fetch?: typeof globalThis.fetch;
}): Promise<McpOAuthClient> {
  if (!params.server.registrationEndpoint) {
    throw new McpRequestError({
      code: "invalid_response",
      operation: "oauth/register",
      message:
        "This MCP server does not allow apps to register themselves. Connect it with a token instead.",
      requestSent: false,
    });
  }

  const parsed = clientRegistrationResponseSchema.safeParse(
    await postOAuth({
      url: params.server.registrationEndpoint,
      contentType: "application/json",
      operation: "oauth/register",
      fetch: params.fetch ?? globalThis.fetch.bind(globalThis),
      body: JSON.stringify({
        client_name: params.clientName,
        redirect_uris: [params.redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    }),
  );

  if (!parsed.success) {
    throw new McpRequestError({
      code: "invalid_response",
      operation: "oauth/register",
      message: "The MCP server's sign-in service did not return a client id.",
      requestSent: true,
    });
  }

  return {
    clientId: parsed.data.client_id,
    ...(parsed.data.client_secret ? { clientSecret: parsed.data.client_secret } : {}),
  };
}

export function buildMcpAuthorizationUrl(params: {
  server: McpAuthorizationServer;
  client: McpOAuthClient;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource: string;
  scopes?: readonly string[];
}): string {
  const url = new URL(params.server.authorizationEndpoint);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.client.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", params.resource);

  if (params.scopes?.length) {
    url.searchParams.set("scope", params.scopes.join(" "));
  }

  return url.toString();
}

export async function exchangeMcpAuthorizationCode(params: {
  server: McpAuthorizationServer;
  client: McpOAuthClient;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  resource: string;
  fetch?: typeof globalThis.fetch;
  now?: number;
}): Promise<McpOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
    resource: params.resource,
    ...clientParameters(params.client),
  });

  return toTokens(
    await postOAuth({
      url: params.server.tokenEndpoint,
      contentType: "application/x-www-form-urlencoded",
      operation: "oauth/token",
      fetch: params.fetch ?? globalThis.fetch.bind(globalThis),
      body: body.toString(),
    }),
    "oauth/token",
    params.now ?? Date.now(),
  );
}

export async function refreshMcpAccessToken(params: {
  server: McpAuthorizationServer;
  client: McpOAuthClient;
  refreshToken: string;
  resource: string;
  fetch?: typeof globalThis.fetch;
  now?: number;
}): Promise<McpOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    resource: params.resource,
    ...clientParameters(params.client),
  });
  const tokens = toTokens(
    await postOAuth({
      url: params.server.tokenEndpoint,
      contentType: "application/x-www-form-urlencoded",
      operation: "oauth/refresh",
      fetch: params.fetch ?? globalThis.fetch.bind(globalThis),
      body: body.toString(),
    }),
    "oauth/refresh",
    params.now ?? Date.now(),
  );

  return tokens.refreshToken ? tokens : { ...tokens, refreshToken: params.refreshToken };
}
