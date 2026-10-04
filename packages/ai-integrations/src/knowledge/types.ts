import type {
  KnowledgeConnectorCapability,
  KnowledgeDocumentPermissions,
  KnowledgeSyncDocument,
  KnowledgeSyncPage,
  SourceSyncCheckpoint,
} from "@ngriffin_uk/polychat-schemas";

import type { ComposioEnvironment } from "../composio/request.js";

export type KnowledgeReadMethod = "GET" | "POST";

export interface KnowledgeReadRequest {
  method?: KnowledgeReadMethod;
  body?: Record<string, unknown>;
}

export type KnowledgeRead = (endpoint: string, request?: KnowledgeReadRequest) => Promise<unknown>;

export interface KnowledgeReadScope {
  origin: string;
  pathPrefix: string;
  methods: readonly KnowledgeReadMethod[];
}

export type KnowledgeConnectorCredentials =
  | { type: "composio"; env: ComposioEnvironment; accountId: string }
  | { type: "api_key"; token: string };

export interface KnowledgeConnectorAdapter {
  capability: KnowledgeConnectorCapability;
  createReader(credentials: KnowledgeConnectorCredentials): KnowledgeRead;
  normaliseRoot(value: string): string;
  initialCheckpoint(rootId: string): SourceSyncCheckpoint;
  validateRoot(read: KnowledgeRead, rootId: string): Promise<void>;
  listDocuments(read: KnowledgeRead, checkpoint: SourceSyncCheckpoint): Promise<KnowledgeSyncPage>;
  getPermissions(
    read: KnowledgeRead,
    document: KnowledgeSyncDocument,
  ): Promise<KnowledgeDocumentPermissions>;
  readContent(
    read: KnowledgeRead,
    document: KnowledgeSyncDocument,
    cachedContent?: string,
  ): Promise<string>;
}

export interface KnowledgeConnectorSession {
  adapter: KnowledgeConnectorAdapter;
  read: KnowledgeRead;
}
