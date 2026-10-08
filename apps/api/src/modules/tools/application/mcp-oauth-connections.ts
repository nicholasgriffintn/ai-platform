import {
  buildMcpAuthorizationUrl,
  createPkcePair,
  discoverMcpAuthorization,
  exchangeMcpAuthorizationCode,
  McpRequestError,
  refreshMcpAccessToken,
  registerMcpOAuthClient,
  type McpAuthorizationServer,
  type McpOAuthClient,
  type McpOAuthTokens,
} from "@ngriffin_uk/polychat-ai-integrations";
import {
  mcpCredentialEndpointSchema,
  mcpOAuthStartInputSchema,
  type McpOAuthStartInput,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, isRecord } from "@ngriffin_uk/polychat-utility-core";
import {
  decryptJsonPayload,
  encryptJsonPayload,
  isEncryptedJsonPayload,
  sha256Hex,
} from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { appendUrlPath } from "@ngriffin_uk/polychat-utility-server/urls";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ProviderConnectionRecord } from "~/modules/apps/infrastructure/ProviderConnectionRepository";

import {
  MCP_OAUTH_CONNECTION_KIND,
  mcpConnectionKey,
  publicMcpConnection,
} from "./mcp-connection-records";

const STATE_PROVIDER = "mcp";
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;
const CALLBACK_PATH = "/tools/mcp/oauth/callback";
const RETURN_PATH = "/chat/plugins";

const storedServerSchema = z.object({
  issuer: z.string(),
  authorizationEndpoint: z.string(),
  tokenEndpoint: z.string(),
  registrationEndpoint: z.string().optional(),
});

const storedClientSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string().optional(),
});

const storedTokensSchema = z.object({
  accessToken: z.string(),
  tokenType: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
});

const storedCredentialSchema = z.object({
  server: storedServerSchema,
  client: storedClientSchema,
  resource: z.string(),
  tokens: storedTokensSchema,
});

const pendingFlowSchema = z.object({
  userId: z.coerce.number().int().positive(),
  label: z.string(),
  url: z.string(),
  allowedTools: z.string(),
  resource: z.string(),
  server: z.string(),
  client: z.string(),
});

function callbackUri(context: Pick<ServiceContext, "env">): string {
  const apiBaseUrl = context.env.API_BASE_URL;

  if (!apiBaseUrl) {
    throw new AssistantError(
      "MCP sign-in is not configured on this deployment",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return appendUrlPath(apiBaseUrl, CALLBACK_PATH);
}

export function mcpOAuthReturnUrl(
  context: Pick<ServiceContext, "env">,
  outcome: "connected" | "failed",
): string {
  const url = new URL(
    appendUrlPath(context.env.APP_BASE_URL ?? "https://polychat.app", RETURN_PATH),
  );

  url.searchParams.set("mcp", outcome);

  return url.toString();
}

function toMcpSetupError(error: unknown): never {
  if (error instanceof McpRequestError) {
    throw new AssistantError(error.message, ErrorType.EXTERNAL_API_ERROR, 502);
  }

  throw error;
}

export async function startMcpOAuthConnection(
  context: ServiceContext,
  input: McpOAuthStartInput,
): Promise<{ authorizationUrl: string }> {
  const user = context.requireUser();
  const parsed = mcpOAuthStartInputSchema.parse(input);
  const url = new URL(mcpCredentialEndpointSchema.parse(parsed.url)).toString();
  const redirectUri = callbackUri(context);

  try {
    const discovery = await discoverMcpAuthorization({ serverUrl: url });
    const client = await registerMcpOAuthClient({
      server: discovery.authorizationServer,
      redirectUri,
      clientName: "Polychat",
    });
    const pkce = await createPkcePair();
    const state = `${generateId()}${generateId()}`;
    const now = new Date();

    await context.repositories.oauthStates.create({
      stateHash: await sha256Hex(state),
      provider: STATE_PROVIDER,
      codeVerifier: pkce.verifier,
      redirectUri,
      context: {
        userId: String(user.id),
        label: parsed.label,
        url,
        allowedTools: JSON.stringify([...new Set(parsed.allowedTools)]),
        resource: discovery.resource,
        server: JSON.stringify(discovery.authorizationServer),
        client: JSON.stringify(client),
      },
      createdAt: now,
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
    });

    return {
      authorizationUrl: buildMcpAuthorizationUrl({
        server: discovery.authorizationServer,
        client,
        redirectUri,
        state,
        codeChallenge: pkce.challenge,
        resource: discovery.resource,
        scopes: discovery.scopes,
      }),
    };
  } catch (error) {
    return toMcpSetupError(error);
  }
}

async function encryptCredential(
  context: Pick<ServiceContext, "env">,
  userId: number,
  externalId: string,
  url: string,
  credential: z.infer<typeof storedCredentialSchema>,
) {
  return encryptJsonPayload({
    keyMaterial: mcpConnectionKey(context.env, userId),
    additionalData: `${externalId}:${url}`,
    payload: credential,
  });
}

export async function completeMcpOAuthConnection(
  context: Pick<ServiceContext, "env" | "repositories">,
  input: { state: string; code?: string; error?: string },
): Promise<{ connected: boolean }> {
  const record = await context.repositories.oauthStates.consumeByStateHash(
    await sha256Hex(input.state),
  );

  if (!record || record.provider !== STATE_PROVIDER || record.expiresAt.getTime() < Date.now()) {
    return { connected: false };
  }

  const flow = pendingFlowSchema.safeParse(record.context);

  if (!flow.success || !input.code || input.error || !record.codeVerifier || !record.redirectUri) {
    return { connected: false };
  }

  const server = storedServerSchema.parse(safeParseJson(flow.data.server));
  const client = storedClientSchema.parse(safeParseJson(flow.data.client));
  const allowedTools = z.array(z.string()).parse(safeParseJson(flow.data.allowedTools));
  const tokens = await exchangeMcpAuthorizationCode({
    server,
    client,
    code: input.code,
    codeVerifier: record.codeVerifier,
    redirectUri: record.redirectUri,
    resource: flow.data.resource,
  });
  const externalId = generateId();

  await context.repositories.providerConnections.upsertConnection({
    userId: flow.data.userId,
    provider: "mcp",
    kind: MCP_OAUTH_CONNECTION_KIND,
    externalId,
    encryptedData: await encryptCredential(context, flow.data.userId, externalId, flow.data.url, {
      server,
      client,
      resource: flow.data.resource,
      tokens,
    }),
    metadata: {
      label: flow.data.label,
      url: flow.data.url,
      credentialRecipient: "polychat",
      authMethod: "oauth",
      allowedTools,
    },
  });

  return { connected: true };
}

function readRecord(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? safeParseJson(value) : value;

  return isRecord(parsed) ? parsed : {};
}

function needsRefresh(tokens: McpOAuthTokens, now: number): boolean {
  return Boolean(
    tokens.refreshToken &&
    tokens.expiresAt &&
    Date.parse(tokens.expiresAt) - REFRESH_MARGIN_MS <= now,
  );
}

export async function resolveMcpOAuthAccessToken(
  context: ServiceContext,
  record: ProviderConnectionRecord,
): Promise<string> {
  const connection = publicMcpConnection(record);
  const encrypted = safeParseJson(record.encrypted_data);

  if (!isEncryptedJsonPayload(encrypted)) {
    throw new AssistantError(
      "MCP connection needs to be reconnected",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  const credential = storedCredentialSchema.parse(
    await decryptJsonPayload({
      keyMaterial: mcpConnectionKey(context.env, record.user_id),
      encrypted,
      additionalData: `${record.external_id}:${connection.url}`,
    }),
  );
  const server: McpAuthorizationServer = credential.server;
  const client: McpOAuthClient = credential.client;

  if (!needsRefresh(credential.tokens, Date.now()) || !credential.tokens.refreshToken) {
    return credential.tokens.accessToken;
  }

  try {
    const tokens = await refreshMcpAccessToken({
      server,
      client,
      refreshToken: credential.tokens.refreshToken,
      resource: credential.resource,
    });

    await context.repositories.providerConnections.upsertConnection({
      userId: record.user_id,
      provider: "mcp",
      kind: MCP_OAUTH_CONNECTION_KIND,
      externalId: record.external_id,
      encryptedData: await encryptCredential(
        context,
        record.user_id,
        record.external_id,
        connection.url,
        { ...credential, tokens },
      ),
      metadata: readRecord(record.metadata),
    });

    return tokens.accessToken;
  } catch (error) {
    if (error instanceof McpRequestError) {
      throw new AssistantError(
        `${connection.label} needs to be reconnected: ${error.message}`,
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    throw error;
  }
}
