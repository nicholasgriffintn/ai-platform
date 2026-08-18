import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";

import type { ComposioAuthConfigDefinition, ConnectorProviderConfig } from "..";

const COMPOSIO_API_BASE_URL = "https://backend.composio.dev/api/v3.1";
const COMPOSIO_REQUEST_TIMEOUT_MS = 20_000;
const MAX_PAGES = 20;
const POSTHOG_QUERY_GUIDANCE =
  "Pass query as a HogQL string or { kind: 'HogQLQuery', query: string }. projectId, organizationId, and region use saved recipe configuration when omitted.";

export interface ComposioConnectedAccount {
  id: string;
  userId: string;
  toolkitSlug: string;
  authConfigId?: string;
  status: string;
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
  isDisabled: boolean;
}

interface ComposioAuthConfig {
  id: string;
  name: string;
  toolkitSlug: string;
  authScheme: string;
  isManaged: boolean;
  status: string;
  restrictedToolSlugs: string[];
}

export interface ComposioToolSchema {
  slug: string;
  name: string;
  description: string;
  toolkitSlug: string;
  access: "read" | "write";
  inputSchema: Record<string, unknown>;
}

export interface ComposioToolSearchResult {
  sessionId: string;
  executionGuidance?: string;
  recommendedPlanSteps: string[];
  knownPitfalls: string[];
  tools: ComposioToolSchema[];
}

export interface ComposioSessionMountFileUrl {
  url: string;
  mountRelativePath: string;
  sandboxMountPrefix: string;
  expiresAt: string;
}

const COMPOSIO_CONNECT_LINK_ORIGINS = new Set([
  "https://app.composio.dev",
  "https://connect.composio.dev",
]);

function requireUserNamespace(env: IEnv): string {
  const namespace = env.COMPOSIO_USER_NAMESPACE?.trim().toLowerCase();

  if (!namespace || !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(namespace)) {
    throw new AssistantError(
      "Composio user namespace is not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return namespace;
}

export function getComposioUserId(env: IEnv, userId: number): string {
  return `polychat:${requireUserNamespace(env)}:user:${userId}`;
}

export function isComposioConfigured(env: IEnv): boolean {
  try {
    return Boolean(env.COMPOSIO_API_KEY?.trim() && requireUserNamespace(env));
  } catch {
    return false;
  }
}

export function isComposioProviderConfigured(
  env: IEnv,
  provider: ConnectorProviderConfig,
): boolean {
  if (provider.auth.authType !== "composio" || !isComposioConfigured(env)) {
    return false;
  }

  return true;
}

function requireApiKey(env: IEnv): string {
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

async function composioRequest<T>(params: {
  env: IEnv;
  path: string;
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${COMPOSIO_API_BASE_URL}${params.path}`, {
      method: params.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": requireApiKey(params.env),
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

function parsePage(value: unknown, resource: string): { items: unknown[]; nextCursor?: string } {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new AssistantError(
      `Composio ${resource} response is invalid`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return {
    items: value.items,
    nextCursor: typeof value.next_cursor === "string" ? value.next_cursor : undefined,
  };
}

function parseConnectLinkUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);

    return COMPOSIO_CONNECT_LINK_ORIGINS.has(url.origin) && url.pathname.startsWith("/link/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function parseHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseSessionMountFileUrl(
  value: unknown,
  urlField: "upload_url" | "download_url",
): ComposioSessionMountFileUrl {
  if (!isRecord(value)) {
    throw new AssistantError(
      "Composio session file response is invalid",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const url = parseHttpsUrl(value[urlField]);

  if (
    !url ||
    typeof value.mount_relative_path !== "string" ||
    typeof value.sandbox_mount_prefix !== "string" ||
    typeof value.expires_at !== "string"
  ) {
    throw new AssistantError(
      "Composio session file response is invalid",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return {
    url,
    mountRelativePath: value.mount_relative_path,
    sandboxMountPrefix: value.sandbox_mount_prefix,
    expiresAt: value.expires_at,
  };
}

export async function createComposioSessionMountUploadUrl(params: {
  env: IEnv;
  sessionId: string;
  mountId?: string;
  mountRelativePath: string;
  mimeType: string;
}): Promise<ComposioSessionMountFileUrl> {
  const response = await composioRequest<unknown>({
    env: params.env,
    path: `/tool_router/session/${encodeURIComponent(params.sessionId)}/mounts/${encodeURIComponent(params.mountId ?? "files")}/upload_url`,
    method: "POST",
    body: { mount_relative_path: params.mountRelativePath, mimetype: params.mimeType },
  });

  return parseSessionMountFileUrl(response, "upload_url");
}

export async function createComposioSessionMountDownloadUrl(params: {
  env: IEnv;
  sessionId: string;
  mountId?: string;
  mountRelativePath: string;
}): Promise<ComposioSessionMountFileUrl> {
  const response = await composioRequest<unknown>({
    env: params.env,
    path: `/tool_router/session/${encodeURIComponent(params.sessionId)}/mounts/${encodeURIComponent(params.mountId ?? "files")}/download_url`,
    method: "POST",
    body: { mount_relative_path: params.mountRelativePath },
  });

  return parseSessionMountFileUrl(response, "download_url");
}

function parseConnectedAccount(value: unknown): ComposioConnectedAccount | null {
  if (!isRecord(value) || !isRecord(value.toolkit)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.user_id !== "string" ||
    typeof value.toolkit.slug !== "string" ||
    typeof value.status !== "string" ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    userId: value.user_id,
    toolkitSlug: value.toolkit.slug,
    authConfigId:
      isRecord(value.auth_config) && typeof value.auth_config.id === "string"
        ? value.auth_config.id
        : undefined,
    status: value.status,
    statusReason: typeof value.status_reason === "string" ? value.status_reason : undefined,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    isDisabled: value.is_disabled === true,
  };
}

export async function listComposioConnectedAccounts(params: {
  env: IEnv;
  userId: number;
  toolkitSlugs?: string[];
  authConfigIds?: string[];
  connectedAccountIds?: string[];
}): Promise<ComposioConnectedAccount[]> {
  const accounts: ComposioConnectedAccount[] = [];
  const accountIds = new Set<string>();
  const expectedUserId = getComposioUserId(params.env, params.userId);
  const allowedToolkitSlugs = params.toolkitSlugs ? new Set(params.toolkitSlugs) : undefined;
  const allowedAuthConfigIds = params.authConfigIds ? new Set(params.authConfigIds) : undefined;
  const allowedConnectedAccountIds = params.connectedAccountIds
    ? new Set(params.connectedAccountIds)
    : undefined;
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      user_ids: getComposioUserId(params.env, params.userId),
      limit: "50",
      order_by: "updated_at",
      order_direction: "desc",
    });

    if (params.toolkitSlugs?.length) {
      query.set("toolkit_slugs", params.toolkitSlugs.join(","));
    }

    if (params.authConfigIds?.length) {
      query.set("auth_config_ids", params.authConfigIds.join(","));
    }

    if (params.connectedAccountIds?.length) {
      query.set("connected_account_ids", params.connectedAccountIds.join(","));
    }

    if (cursor) {
      query.set("cursor", cursor);
    }

    const response = parsePage(
      await composioRequest<unknown>({
        env: params.env,
        path: `/connected_accounts?${query.toString()}`,
      }),
      "account",
    );

    for (const item of response.items) {
      const account = parseConnectedAccount(item);

      if (
        account?.userId === expectedUserId &&
        (!allowedToolkitSlugs || allowedToolkitSlugs.has(account.toolkitSlug)) &&
        (!allowedAuthConfigIds ||
          (account.authConfigId != null && allowedAuthConfigIds.has(account.authConfigId))) &&
        (!allowedConnectedAccountIds || allowedConnectedAccountIds.has(account.id)) &&
        !accountIds.has(account.id)
      ) {
        accountIds.add(account.id);
        accounts.push(account);
      }
    }

    cursor = response.nextCursor;
    if (!cursor) {
      return accounts;
    }
  }

  throw new AssistantError(
    "Composio account pagination exceeded its safety limit",
    ErrorType.EXTERNAL_API_ERROR,
    502,
  );
}

function parseAuthConfig(value: unknown): ComposioAuthConfig | null {
  const restrictedTools = isRecord(value) ? value.restrict_to_following_tools : undefined;

  if (
    !isRecord(value) ||
    !isRecord(value.toolkit) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.toolkit.slug !== "string" ||
    typeof value.auth_scheme !== "string" ||
    typeof value.status !== "string" ||
    (restrictedTools != null &&
      (!Array.isArray(restrictedTools) ||
        !restrictedTools.every((tool) => typeof tool === "string")))
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    toolkitSlug: value.toolkit.slug,
    authScheme: value.auth_scheme,
    isManaged: value.is_composio_managed === true,
    status: value.status,
    restrictedToolSlugs: Array.isArray(restrictedTools)
      ? restrictedTools.filter((tool): tool is string => typeof tool === "string")
      : [],
  };
}

function validateConfiguredAuthConfig(params: {
  config: ComposioAuthConfig | null;
  provider: ConnectorProviderConfig;
  expected: ComposioAuthConfigDefinition;
}): ComposioAuthConfig {
  const { config, expected, provider } = params;

  if (provider.auth.authType !== "composio") {
    throw new AssistantError("Connector is not managed by Composio", ErrorType.CONFIGURATION_ERROR);
  }

  const expectedTools = provider.operations.flatMap((operation) =>
    operation.authConfigIds?.includes(expected.id) ? [operation.id] : [],
  );

  if (
    !config ||
    config.id !== expected.id ||
    config.toolkitSlug !== provider.auth.toolkitSlug ||
    config.status !== "ENABLED" ||
    config.authScheme !== expected.authScheme ||
    config.isManaged !== expected.isManaged ||
    (config.restrictedToolSlugs.length > 0 &&
      expectedTools.some((tool) => !config.restrictedToolSlugs.includes(tool)))
  ) {
    throw new AssistantError(
      `Configured Composio auth config does not match ${provider.name}`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return config;
}

async function ensureAuthConfig(params: {
  env: IEnv;
  provider: ConnectorProviderConfig;
  authConfigId: string;
}): Promise<ComposioAuthConfig> {
  if (params.provider.auth.authType !== "composio") {
    throw new AssistantError("Connector is not managed by Composio", ErrorType.CONFIGURATION_ERROR);
  }

  const auth = params.provider.auth;
  const expected = auth.authConfigs.find((config) => config.id === params.authConfigId);

  if (!expected) {
    throw new AssistantError("Unknown Composio auth config", ErrorType.PARAMS_ERROR, 400);
  }

  const config = parseAuthConfig(
    await composioRequest<unknown>({
      env: params.env,
      path: `/auth_configs/${encodeURIComponent(expected.id)}`,
    }),
  );

  return validateConfiguredAuthConfig({ config, expected, provider: params.provider });
}

export async function createComposioConnectLink(params: {
  env: IEnv;
  userId: number;
  provider: ConnectorProviderConfig;
  authConfigId: string;
  callbackUrl: string;
}): Promise<{ redirectUrl: string; connectedAccountId: string; sessionId?: string }> {
  if (params.provider.auth.authType !== "composio") {
    throw new AssistantError("Connector is not managed by Composio", ErrorType.PARAMS_ERROR, 400);
  }

  const authConfig = await ensureAuthConfig({
    env: params.env,
    provider: params.provider,
    authConfigId: params.authConfigId,
  });
  const auth = params.provider.auth;

  if (authConfig.isManaged && ["OAUTH1", "OAUTH2", "DCR_OAUTH"].includes(authConfig.authScheme)) {
    const link = await composioRequest<unknown>({
      env: params.env,
      path: "/connected_accounts/link",
      method: "POST",
      body: {
        user_id: getComposioUserId(params.env, params.userId),
        auth_config_id: authConfig.id,
        callback_url: params.callbackUrl,
        allow_multiple: false,
      },
    });
    const redirectUrl = isRecord(link) ? parseConnectLinkUrl(link.redirect_url) : null;
    const connectedAccountId =
      isRecord(link) && typeof link.id === "string"
        ? link.id
        : isRecord(link) && typeof link.connected_account_id === "string"
          ? link.connected_account_id
          : null;

    if (!redirectUrl || !connectedAccountId) {
      throw new AssistantError(
        "Composio link response is invalid",
        ErrorType.EXTERNAL_API_ERROR,
        502,
      );
    }

    return { redirectUrl, connectedAccountId };
  }

  const session = await composioRequest<unknown>({
    env: params.env,
    path: "/tool_router/session",
    method: "POST",
    body: {
      user_id: getComposioUserId(params.env, params.userId),
      toolkits: { enable: [auth.toolkitSlug] },
      auth_configs: { [auth.toolkitSlug]: authConfig.id },
      manage_connections: {
        enable: true,
        callback_url: params.callbackUrl,
        enable_wait_for_connections: false,
        enable_connection_removal: false,
      },
      workbench: { enable: false, enable_proxy_execution: false },
      multi_account: { enable: false },
      search: { enable: false },
      execute: { enable_multi_execute: false },
    },
  });

  if (!isRecord(session) || typeof session.session_id !== "string") {
    throw new AssistantError(
      "Composio session response is invalid",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  try {
    const link = await composioRequest<unknown>({
      env: params.env,
      path: `/tool_router/session/${encodeURIComponent(session.session_id)}/link`,
      method: "POST",
      body: { toolkit: auth.toolkitSlug, callback_url: params.callbackUrl },
    });
    const redirectUrl = isRecord(link) ? parseConnectLinkUrl(link.redirect_url) : null;

    if (!isRecord(link) || !redirectUrl || typeof link.connected_account_id !== "string") {
      throw new AssistantError(
        "Composio link response is invalid",
        ErrorType.EXTERNAL_API_ERROR,
        502,
      );
    }

    return {
      redirectUrl,
      connectedAccountId: link.connected_account_id,
      sessionId: session.session_id,
    };
  } catch (error) {
    await deleteComposioToolSession({ env: params.env, sessionId: session.session_id }).catch(
      () => undefined,
    );
    throw error;
  }
}

function parseSessionId(value: unknown): string {
  if (!isRecord(value) || typeof value.session_id !== "string") {
    throw new AssistantError(
      "Composio session response is invalid",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return value.session_id;
}

interface ToolSchemaIdentity {
  operation: ConnectorProviderConfig["operations"][number];
  slug: string;
  description: string;
  toolkitSlug: string;
}

function parseToolSchemaIdentity(
  value: unknown,
  provider: ConnectorProviderConfig,
): ToolSchemaIdentity | null {
  if (provider.auth.authType !== "composio") {
    return null;
  }

  if (
    !isRecord(value) ||
    typeof value.tool_slug !== "string" ||
    typeof value.description !== "string" ||
    typeof value.toolkit !== "string"
  ) {
    return null;
  }

  const operation = provider.operations.find((candidate) => candidate.id === value.tool_slug);

  if (!operation || value.toolkit.toLowerCase() !== provider.auth.toolkitSlug.toLowerCase()) {
    return null;
  }

  return {
    operation,
    slug: value.tool_slug,
    description: value.description,
    toolkitSlug: provider.auth.toolkitSlug,
  };
}

function parseToolSchema(
  value: unknown,
  provider: ConnectorProviderConfig,
): ComposioToolSchema | null {
  const identity = parseToolSchemaIdentity(value, provider);

  if (!identity || !isRecord(value) || !isRecord(value.input_schema)) {
    return null;
  }

  let inputSchema = value.input_schema;

  if (
    provider.id === "posthog" &&
    identity.operation.id === "POSTHOG_CREATE_QUERY_IN_PROJECT_BY_ID"
  ) {
    inputSchema = {
      ...inputSchema,
      description:
        typeof inputSchema.description === "string"
          ? `${inputSchema.description} ${POSTHOG_QUERY_GUIDANCE}`
          : POSTHOG_QUERY_GUIDANCE,
    };
  }

  return {
    slug: identity.slug,
    name: identity.slug
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    description: identity.description,
    toolkitSlug: identity.toolkitSlug,
    access: identity.operation.access,
    inputSchema,
  };
}

function parseReferencedToolSlug(value: unknown, provider: ConnectorProviderConfig): string | null {
  const identity = parseToolSchemaIdentity(value, provider);

  if (
    !identity ||
    !isRecord(value) ||
    !isRecord(value.schemaRef) ||
    value.schemaRef.tool !== "COMPOSIO_GET_TOOL_SCHEMAS" ||
    !isRecord(value.schemaRef.args) ||
    !Array.isArray(value.schemaRef.args.tool_slugs) ||
    !value.schemaRef.args.tool_slugs.includes(identity.slug)
  ) {
    return null;
  }

  return identity.slug;
}

async function resolveReferencedToolSchemas(params: {
  env: IEnv;
  sessionId: string;
  provider: ConnectorProviderConfig;
  toolSchemas: Record<string, unknown>;
}): Promise<ComposioToolSchema[]> {
  const toolSlugs = [
    ...new Set(
      Object.values(params.toolSchemas).flatMap((schema) => {
        const slug = parseReferencedToolSlug(schema, params.provider);

        return slug ? [slug] : [];
      }),
    ),
  ];

  if (toolSlugs.length === 0) {
    return [];
  }

  const response = await composioRequest<unknown>({
    env: params.env,
    path: `/tool_router/session/${encodeURIComponent(params.sessionId)}/execute_meta`,
    method: "POST",
    body: {
      slug: "COMPOSIO_GET_TOOL_SCHEMAS",
      arguments: { tool_slugs: toolSlugs, include: ["input_schema"] },
    },
  });

  if (
    !isRecord(response) ||
    !isRecord(response.data) ||
    response.data.success !== true ||
    !isRecord(response.data.tool_schemas)
  ) {
    throw new AssistantError(
      "Composio tool schema response is invalid",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const schemas = Object.values(response.data.tool_schemas)
    .map((schema) => parseToolSchema(schema, params.provider))
    .filter((schema): schema is ComposioToolSchema => schema !== null);
  const resolvedSlugs = new Set(schemas.map((schema) => schema.slug));

  if (toolSlugs.some((slug) => !resolvedSlugs.has(slug))) {
    throw new AssistantError(
      "Composio did not return every requested tool schema",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return schemas;
}

export async function createComposioToolSession(params: {
  env: IEnv;
  userId: number;
  provider: ConnectorProviderConfig;
  connectedAccount: ComposioConnectedAccount;
  allowedToolSlugs: string[];
}): Promise<string> {
  if (params.provider.auth.authType !== "composio") {
    throw new AssistantError("Connector is not managed by Composio", ErrorType.PARAMS_ERROR, 400);
  }

  if (!params.connectedAccount.authConfigId) {
    throw new AssistantError(
      "Connected account has no auth config",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const availableTools = new Set(
    params.provider.operations
      .filter((operation) =>
        operation.authConfigIds?.includes(params.connectedAccount.authConfigId),
      )
      .map((operation) => operation.id),
  );
  const allowedTools = [...new Set(params.allowedToolSlugs)].filter((slug) =>
    availableTools.has(slug),
  );

  if (allowedTools.length === 0) {
    throw new AssistantError("No connector tools are enabled", ErrorType.AUTHORISATION_ERROR, 403);
  }

  const session = await composioRequest<unknown>({
    env: params.env,
    path: "/tool_router/session",
    method: "POST",
    body: {
      user_id: getComposioUserId(params.env, params.userId),
      toolkits: { enable: [params.provider.auth.toolkitSlug] },
      auth_configs: {
        [params.provider.auth.toolkitSlug]: params.connectedAccount.authConfigId,
      },
      connected_accounts: {
        [params.provider.auth.toolkitSlug]: [params.connectedAccount.id],
      },
      tools: { [params.provider.auth.toolkitSlug]: { enable: allowedTools } },
      manage_connections: { enable: false },
      workbench: { enable: false, enable_proxy_execution: false },
      multi_account: { enable: false },
      search: { enable: true },
      execute: { enable_multi_execute: false },
    },
  });

  return parseSessionId(session);
}

export async function searchComposioSessionTools(params: {
  env: IEnv;
  sessionId: string;
  provider: ConnectorProviderConfig;
  useCase: string;
}): Promise<ComposioToolSearchResult> {
  const response = await composioRequest<unknown>({
    env: params.env,
    path: `/tool_router/session/${encodeURIComponent(params.sessionId)}/search`,
    method: "POST",
    body: { queries: [{ use_case: params.useCase }] },
  });

  if (!isRecord(response) || !Array.isArray(response.results) || !isRecord(response.tool_schemas)) {
    throw new AssistantError(
      "Composio tool search response is invalid",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const result = isRecord(response.results[0]) ? response.results[0] : undefined;
  const inlineTools = Object.values(response.tool_schemas)
    .map((schema) => parseToolSchema(schema, params.provider))
    .filter((schema): schema is ComposioToolSchema => schema !== null);
  const referencedTools = await resolveReferencedToolSchemas({
    env: params.env,
    sessionId: params.sessionId,
    provider: params.provider,
    toolSchemas: response.tool_schemas,
  });
  const tools = [
    ...new Map(
      [...inlineTools, ...referencedTools].map((schema) => [schema.slug, schema] as const),
    ).values(),
  ];

  if (tools.length === 0) {
    throw new AssistantError("No matching connector tools found", ErrorType.NOT_FOUND, 404);
  }

  return {
    sessionId: params.sessionId,
    executionGuidance:
      result && typeof result.execution_guidance === "string"
        ? result.execution_guidance
        : undefined,
    recommendedPlanSteps:
      result && Array.isArray(result.recommended_plan_steps)
        ? result.recommended_plan_steps.filter((step): step is string => typeof step === "string")
        : [],
    knownPitfalls:
      result && Array.isArray(result.known_pitfalls)
        ? result.known_pitfalls.filter((pitfall): pitfall is string => typeof pitfall === "string")
        : [],
    tools,
  };
}

function validateSessionScope(params: {
  session: unknown;
  expectedUserId: string;
  provider: ConnectorProviderConfig;
  toolSlug: string;
  authConfigId: string;
  connectedAccountId: string;
}) {
  if (params.provider.auth.authType !== "composio" || !isRecord(params.session)) {
    return false;
  }

  const config = isRecord(params.session.config) ? params.session.config : undefined;
  const toolkits = config && isRecord(config.toolkits) ? config.toolkits : undefined;
  const tools = config && isRecord(config.tools) ? config.tools : undefined;
  const authConfigs = config && isRecord(config.auth_configs) ? config.auth_configs : undefined;
  const connectedAccounts =
    config && isRecord(config.connected_accounts) ? config.connected_accounts : undefined;
  const providerToolsValue = tools?.[params.provider.auth.toolkitSlug];
  const providerTools = isRecord(providerToolsValue) ? providerToolsValue : undefined;
  const configuredAccounts = connectedAccounts?.[params.provider.auth.toolkitSlug];

  return (
    config?.user_id === params.expectedUserId &&
    Array.isArray(toolkits?.enabled) &&
    toolkits.enabled.includes(params.provider.auth.toolkitSlug) &&
    authConfigs?.[params.provider.auth.toolkitSlug] === params.authConfigId &&
    ((Array.isArray(configuredAccounts) &&
      configuredAccounts.includes(params.connectedAccountId)) ||
      configuredAccounts === params.connectedAccountId) &&
    Array.isArray(providerTools?.enabled) &&
    providerTools.enabled.includes(params.toolSlug)
  );
}

export async function executeComposioSessionTool(params: {
  env: IEnv;
  userId: number;
  sessionId: string;
  provider: ConnectorProviderConfig;
  toolSlug: string;
  authConfigId: string;
  connectedAccountId: string;
  arguments: Record<string, unknown>;
}): Promise<{ data: unknown; logId?: string }> {
  const sessionPath = `/tool_router/session/${encodeURIComponent(params.sessionId)}`;
  const session = await composioRequest<unknown>({ env: params.env, path: sessionPath });

  if (
    !validateSessionScope({
      session,
      expectedUserId: getComposioUserId(params.env, params.userId),
      provider: params.provider,
      toolSlug: params.toolSlug,
      authConfigId: params.authConfigId,
      connectedAccountId: params.connectedAccountId,
    })
  ) {
    throw new AssistantError(
      "Composio session is outside connector scope",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const result = await composioRequest<unknown>({
    env: params.env,
    path: `${sessionPath}/execute`,
    method: "POST",
    body: { tool_slug: params.toolSlug, arguments: params.arguments },
  });

  if (!isRecord(result) || result.error) {
    throw new AssistantError("Composio tool execution failed", ErrorType.EXTERNAL_API_ERROR, 502, {
      requestId: isRecord(result) && typeof result.log_id === "string" ? result.log_id : undefined,
    });
  }

  return {
    data: result.data,
    logId: typeof result.log_id === "string" ? result.log_id : undefined,
  };
}

export async function deleteComposioToolSession(params: {
  env: IEnv;
  sessionId: string;
}): Promise<void> {
  try {
    await composioRequest<unknown>({
      env: params.env,
      path: `/tool_router/session/${encodeURIComponent(params.sessionId)}`,
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof AssistantError && error.statusCode === 404) {
      return;
    }

    throw error;
  }
}

export async function completeComposioAuthorization(params: {
  env: IEnv;
  userId: number;
  sessionUri: string;
}): Promise<{ connectedAccountId: string; toolkitSlug: string }> {
  const result = await composioRequest<unknown>({
    env: params.env,
    path: "/connected_accounts/complete_auth",
    method: "POST",
    body: { session_uri: params.sessionUri, user_id: getComposioUserId(params.env, params.userId) },
  });

  if (
    !isRecord(result) ||
    typeof result.connected_account_id !== "string" ||
    typeof result.toolkit_slug !== "string"
  ) {
    throw new AssistantError(
      "Composio verification response is invalid",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return {
    connectedAccountId: result.connected_account_id,
    toolkitSlug: result.toolkit_slug,
  };
}

export async function disconnectComposioAccount(params: {
  env: IEnv;
  connectedAccountId: string;
  revokeAtProvider?: boolean;
}) {
  const id = encodeURIComponent(params.connectedAccountId);

  if (params.revokeAtProvider) {
    try {
      await composioRequest<unknown>({
        env: params.env,
        path: `/connected_accounts/${id}/revoke`,
        method: "POST",
      });
    } catch (error) {
      if (error instanceof AssistantError && error.statusCode === 404) {
        return;
      }

      throw error;
    }
  }

  try {
    await composioRequest<unknown>({
      env: params.env,
      path: `/connected_accounts/${id}`,
      method: "DELETE",
    });
  } catch (error) {
    if (!(error instanceof AssistantError) || error.statusCode !== 404) {
      throw error;
    }
  }
}
