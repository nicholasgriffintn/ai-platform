import { configuredComposioToolkits } from "@ngriffin_uk/polychat-library-composio";
import type { DeviceCredentialScope, RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import { knowledgeBaseConnectorProviders } from "./knowledge-providers.js";
import { personalMediaConnectorProviders } from "./personal-media-providers.js";

export type ConnectorAuthType = "api_key" | "composio";
export type ConnectorOperationAccess = "read" | "write";

export interface ConnectorCredentialField {
  label: string;
  secret: boolean;
}

export interface ConnectorOAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
}

export interface ConnectorAppLinkConfig {
  connectUrl: string;
  credentialScope: DeviceCredentialScope;
}

export interface ApiKeyConnectorConfig {
  authType: "api_key";
  appLink?: ConnectorAppLinkConfig;
  credentialFields: readonly ConnectorCredentialField[];
  credentialSeparator?: string;
  optionalCredentials?: boolean;
  oauth?: ConnectorOAuthConfig;
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
    id: "tfl",
    name: "Transport for London",
    description:
      "Read London stops, planned journeys and disruptions. Public access works without a key; add your own TfL subscription key for a higher request allowance.",
    appUrl: "https://tfl.gov.uk/plan-a-journey/",
    categories: [{ id: "places-&-weather", name: "Places & Weather" }],
    setupUrl: "/chat/plugins?connector=tfl",
    auth: {
      authType: "api_key",
      optionalCredentials: true,
      credentialFields: [{ label: "TfL subscription key", secret: true }],
      scopes: [],
    },
    operations: [
      {
        id: "search_stops",
        access: "read",
        readOnly: true,
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: { query: { type: "string", minLength: 2, maxLength: 120 } },
        },
      },
      {
        id: "plan_journey",
        access: "read",
        readOnly: true,
        inputSchema: {
          type: "object",
          required: ["from", "to", "date", "time"],
          properties: {
            from: {
              type: "string",
              minLength: 1,
              maxLength: 160,
              description:
                "Journey origin: a station name, a stop ID returned by search_stops, UK postcode, or latitude,longitude. Prefer the returned stop ID for a specific station. Resolve any disambiguation before choosing a journey.",
            },
            to: {
              type: "string",
              minLength: 1,
              maxLength: 160,
              description:
                "Journey destination, using the same formats as from. Use the requested station, not a nearby bus stop with a similar name.",
            },
            date: { type: "string", format: "date" },
            time: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          },
        },
      },
    ],
  },
  {
    id: "pashi",
    name: "Pashi",
    description:
      "Open Pashi's apps and use its tools in your chats, and use your Polychat plan for AI on pashi.app. Converting files needs Pro.",
    logoUrl: "https://pashi.app/icon-192.png",
    appUrl: "https://pashi.app",
    categories: [{ id: "developer-tools", name: "Developer tools" }],
    setupUrl: "/chat/plugins?connector=pashi",
    auth: {
      authType: "api_key",
      appLink: { connectUrl: "https://pashi.app/sign-in", credentialScope: "pashi" },
      credentialFields: [],
      scopes: [],
    },
    operations: [],
  },
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
      credentialFields: [{ label: "Service user API key", secret: true }],
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
      credentialFields: [{ label: "API key", secret: true }],
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
      credentialFields: [{ label: "API key", secret: true }],
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
      credentialFields: [{ label: "Personal access token", secret: true }],
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
  ...personalMediaConnectorProviders,
  ...knowledgeBaseConnectorProviders,
];

export const AGENT_IDENTITY_CATEGORY_ID = "ai-agents";

export function isAgentIdentityProvider(provider: ConnectorProviderConfig): boolean {
  return provider.categories.some((category) => category.id === AGENT_IDENTITY_CATEGORY_ID);
}

export function connectorOperationsForAccess(
  provider: ConnectorProviderConfig,
  access: ConnectorOperationAccess,
): string[] {
  const agentIdentity = isAgentIdentityProvider(provider);

  return provider.operations
    .filter(
      (operation) =>
        (agentIdentity || !operation.destructive) &&
        (access === "write" || operation.access === "read"),
    )
    .map((operation) => operation.id)
    .sort();
}

export function getConnectorProviderConfig(
  providerId: string,
): ConnectorProviderConfig | undefined {
  return connectorProviders.find((provider) => provider.id === providerId);
}
