import { configuredComposioToolkits } from "@ngriffin_uk/polychat-library-composio";
import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

export type ConnectorAuthType = "api_key" | "composio";
export type ConnectorOperationAccess = "read" | "write";

export interface ApiKeyConnectorConfig {
  authType: "api_key";
  credentialLabel: string;
  scopes: readonly string[];
}

export interface ComposioConnectorConfig {
  authType: "composio";
  toolkitSlug: string;
  toolkitVersion: string;
  authConfigs: readonly ComposioAuthConfigDefinition[];
  scopes: readonly string[];
}

export interface ComposioAuthConfigDefinition {
  id: string;
  name: string;
  authScheme: string;
  isManaged: boolean;
}

export interface ConnectorProviderConfig {
  id: RecipeConnectorProvider;
  name: string;
  description: string;
  logoUrl?: string;
  appUrl?: string;
  categories: readonly { id: string; name: string }[];
  setupUrl: string;
  auth: ApiKeyConnectorConfig | ComposioConnectorConfig;
  operations: readonly ConnectorOperationConfig[];
}

export interface ConnectorOperationConfig {
  id: string;
  access: ConnectorOperationAccess;
  readOnly?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  openWorld?: boolean;
  isImportant?: boolean;
  authConfigIds?: readonly string[];
  inputSchema?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: readonly string[];
  };
}

export type ConnectorOperationExecutor = (
  token: string,
  operation: string,
  params: Record<string, unknown>,
) => Promise<unknown>;

export const RECIPE_CONNECTOR_APP_ID = "recipe_connector_connection";
export const RECIPE_CONNECTOR_ITEM_TYPE = "oauth_connection";

const localConnectorProviders: ConnectorProviderConfig[] = [
  {
    id: "devin",
    name: "Devin",
    description: "Start Devin sessions, check progress, and send follow-up messages.",
    categories: [{ id: "developer-tools", name: "Developer tools" }],
    setupUrl: "/chat/plugins?connector=devin",
    operations: [
      {
        id: "list_sessions",
        access: "read",
        inputSchema: {
          type: "object",
          required: ["organizationId"],
          properties: {
            organizationId: { type: "string" },
            after: { type: "string" },
            first: { type: "integer", minimum: 1, maximum: 100 },
            createdAfter: { type: "string" },
            createdBefore: { type: "string" },
            updatedAfter: { type: "string" },
            updatedBefore: { type: "string" },
            playbookId: { type: "string" },
            scheduleId: { type: "string" },
            category: { type: "string" },
            session_ids: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            origins: { type: "array", items: { type: "string" } },
            user_ids: { type: "array", items: { type: "string" } },
            service_user_ids: { type: "array", items: { type: "string" } },
            repo_names: { type: "array", items: { type: "string" } },
            isArchived: { type: "boolean" },
          },
        },
      },
      {
        id: "get_session",
        access: "read",
        inputSchema: {
          type: "object",
          required: ["organizationId", "sessionId"],
          properties: {
            organizationId: { type: "string" },
            sessionId: { type: "string" },
          },
        },
      },
      {
        id: "create_session",
        access: "write",
        inputSchema: {
          type: "object",
          required: ["organizationId", "prompt"],
          properties: {
            organizationId: { type: "string" },
            prompt: { type: "string" },
            title: { type: "string" },
            playbookId: { type: "string" },
            createAsUserId: { type: "string" },
            childPlaybookId: { type: "string" },
            platform: { type: "string" },
            devinMode: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            knowledge_ids: { type: "array", items: { type: "string" } },
            secret_ids: { type: "array", items: { type: "string" } },
            repos: { type: "array", items: { type: "string" } },
            attachment_urls: { type: "array", items: { type: "string" } },
            session_links: { type: "array", items: { type: "string" } },
            maxAcuLimit: { type: "integer", minimum: 1 },
            structuredOutputRequired: { type: "boolean" },
          },
        },
      },
      {
        id: "list_messages",
        access: "read",
        inputSchema: {
          type: "object",
          required: ["organizationId", "sessionId"],
          properties: {
            organizationId: { type: "string" },
            sessionId: { type: "string" },
            after: { type: "string" },
            first: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
      {
        id: "send_message",
        access: "write",
        inputSchema: {
          type: "object",
          required: ["organizationId", "sessionId", "message"],
          properties: {
            organizationId: { type: "string" },
            sessionId: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    ],
    auth: {
      authType: "api_key",
      credentialLabel: "Service user API key",
      scopes: ["sessions:read", "sessions:write"],
    },
  },
  {
    id: "hindsight",
    name: "Hindsight",
    description: "Use Hindsight as an external long-term memory provider.",
    categories: [{ id: "ai", name: "AI" }],
    setupUrl: "/chat/plugins?connector=hindsight",
    operations: [],
    auth: {
      authType: "api_key",
      credentialLabel: "API key",
      scopes: ["memory:retain", "memory:recall", "memory:reflect"],
    },
  },
  {
    id: "honcho",
    name: "Honcho",
    description: "Use Honcho as an external memory and peer reasoning provider.",
    categories: [{ id: "ai", name: "AI" }],
    setupUrl: "/chat/plugins?connector=honcho",
    operations: [],
    auth: {
      authType: "api_key",
      credentialLabel: "API key",
      scopes: ["workspaces:write", "sessions:write", "messages:write", "peers:read"],
    },
  },
  {
    id: "netlify",
    name: "Netlify",
    description: "Inspect Netlify sites, deploys, and deployment status.",
    categories: [{ id: "developer-tools", name: "Developer tools" }],
    setupUrl: "/chat/plugins?connector=netlify",
    operations: [
      {
        id: "list_sites",
        access: "read",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            perPage: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
      {
        id: "list_deploys",
        access: "read",
        inputSchema: {
          type: "object",
          required: ["siteId"],
          properties: {
            siteId: { type: "string" },
            page: { type: "integer", minimum: 1 },
            perPage: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
      {
        id: "get_deploy",
        access: "read",
        inputSchema: {
          type: "object",
          required: ["deployId"],
          properties: { deployId: { type: "string" } },
        },
      },
    ],
    auth: {
      authType: "api_key",
      credentialLabel: "Personal access token",
      scopes: ["sites:read", "deploys:read"],
    },
  },
];

const composioConnectorProviders: ConnectorProviderConfig[] = Object.values(
  configuredComposioToolkits,
).map((toolkit) => ({
  id: toolkit.providerId,
  name: toolkit.name,
  description: toolkit.description,
  logoUrl: toolkit.logoUrl,
  appUrl: toolkit.appUrl,
  categories: toolkit.categories,
  setupUrl: `/chat/plugins?connector=${encodeURIComponent(toolkit.providerId)}`,
  operations: toolkit.operations,
  auth: {
    authType: "composio",
    toolkitSlug: toolkit.toolkitSlug,
    toolkitVersion: toolkit.toolkitVersion,
    authConfigs: toolkit.authConfigs,
    scopes: toolkit.scopes,
  },
}));

export const connectorProviders: readonly ConnectorProviderConfig[] = [
  ...composioConnectorProviders,
  ...localConnectorProviders,
];

export function getConnectorProviderConfig(
  providerId: string,
): ConnectorProviderConfig | undefined {
  return connectorProviders.find((provider) => provider.id === providerId);
}
