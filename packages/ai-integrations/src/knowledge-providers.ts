import type { ConnectorProviderConfig } from "./providers.js";

export const KNOWLEDGE_BASE_CONNECTOR_PROVIDERS = [
  "cloudflare_ai_search",
  "bedrock_knowledge_base",
] as const;

export type KnowledgeBaseConnectorProvider = (typeof KNOWLEDGE_BASE_CONNECTOR_PROVIDERS)[number];

export const knowledgeBaseConnectorProviders: ConnectorProviderConfig[] = [
  {
    id: "cloudflare_ai_search",
    name: "Cloudflare AI Search",
    description:
      "Search one of your Cloudflare AI Search instances alongside your own sources, without copying it in.",
    categories: [{ id: "knowledge", name: "Knowledge" }],
    setupUrl: "/chat/plugins?connector=cloudflare_ai_search",
    operations: [],
    auth: {
      authType: "api_key",
      credentialFields: [
        { label: "API token", secret: true },
        { label: "Account ID", secret: false },
        { label: "Instance name", secret: false },
      ],
      credentialSeparator: "|",
      scopes: ["ai-search:read"],
    },
  },
  {
    id: "bedrock_knowledge_base",
    name: "Amazon Bedrock Knowledge Bases",
    description:
      "Search an Amazon Bedrock knowledge base alongside your own sources, without copying it in.",
    categories: [{ id: "knowledge", name: "Knowledge" }],
    setupUrl: "/chat/plugins?connector=bedrock_knowledge_base",
    operations: [],
    auth: {
      authType: "api_key",
      credentialFields: [
        { label: "Secret access key", secret: true },
        { label: "Access key ID", secret: false },
        { label: "Knowledge base ID", secret: false },
        { label: "Region, such as eu-west-1", secret: false },
      ],
      credentialSeparator: "|",
      scopes: ["bedrock:Retrieve"],
    },
  },
];
