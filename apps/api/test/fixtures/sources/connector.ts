import type {
  ConnectorProviderConfig,
  KnowledgeConnectorAdapter,
  ComposioConnectedAccount,
} from "@ngriffin_uk/polychat-ai-integrations";

export const knowledgeTestAdapter: KnowledgeConnectorAdapter = {
  capability: {
    rootLabel: "Collection",
    rootPlaceholder: "collection-id",
    contentDescription: "Collection documents",
  },
  createReader: () => async () => null,
  normaliseRoot: (value) => value,
  initialCheckpoint: (rootId) => ({ collection: rootId, cursor: "initial" }),
  validateRoot: async () => {},
  listDocuments: async (_read, checkpoint) => ({
    documents: [
      {
        id: "collection/page-1",
        title: "Collection decision",
        version: null,
        sourceUrl: null,
        data: null,
      },
    ],
    checkpoint: { collection: checkpoint.collection ?? null, cursor: "next" },
    complete: checkpoint.cursor === "next",
  }),
  getPermissions: async () => ({ public: false, emails: ["one@example.com"], validUntil: null }),
  readContent: async () => "A current collection decision",
};

export const knowledgeTestConnector: ConnectorProviderConfig = {
  id: "notion",
  name: "Notion",
  description: "Test collection source",
  categories: [],
  setupUrl: "/chat/plugins?connector=notion",
  operations: [],
  auth: {
    authType: "composio",
    toolkitSlug: "notion",
    toolkitVersion: "test",
    authConfigs: [{ id: "notion-auth", name: "Notion", authScheme: "OAUTH2", isManaged: true }],
    scopes: [],
  },
  knowledge: knowledgeTestAdapter,
};

export const knowledgeTestAccount: ComposioConnectedAccount = {
  id: "notion-account",
  userId: "user-1",
  toolkitSlug: "notion",
  authConfigId: "notion-auth",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  isDisabled: false,
};
