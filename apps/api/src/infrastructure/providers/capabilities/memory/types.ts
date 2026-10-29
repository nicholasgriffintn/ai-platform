import type { MemoryEvidence } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IEnv, IUser, IUserSettings } from "~/types";

export type MemoryProviderId = "documents" | "hindsight" | "honcho";

export interface MemoryProviderContext {
  env: IEnv;
  user?: IUser;
  userSettings?: IUserSettings | null;
  serviceContext?: ServiceContext;
}

export interface MemoryStoreInput {
  text: string;
  metadata: Record<string, string>;
  conversationId?: string;
  documentId?: string;
  operationId?: string;
  userSettings?: IUserSettings | null;
  evidence?: readonly MemoryEvidence[];
}

export interface MemoryStoreResult {
  id: string | null;
  provider: MemoryProviderId;
  externalId?: string;
}

export interface MemoryRetrieveOptions {
  topK?: number;
  userSettings?: IUserSettings | null;
}

export interface MemoryRetrieveResult {
  id?: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryProviderCapabilities {
  deduplication: boolean;
  reasoning: boolean;
  conversationIngestion: boolean;
  externalStorage: boolean;
  deletion: boolean;
  semanticSearch: boolean;
}

export interface MemoryProvider {
  readonly name: MemoryProviderId;
  readonly capabilities: MemoryProviderCapabilities;
  storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult>;
  retrieveMemories(query: string, options?: MemoryRetrieveOptions): Promise<MemoryRetrieveResult[]>;
  deleteMemory(memoryId: string): Promise<boolean>;
}
