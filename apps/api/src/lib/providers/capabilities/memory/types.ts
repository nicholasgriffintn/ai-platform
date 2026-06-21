import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser, IUserSettings } from "~/types";

export type MemoryProviderId = "built-in" | "hindsight" | "honcho";

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
	userSettings?: IUserSettings | null;
}

export interface MemoryStoreResult {
	id: string | null;
	provider: MemoryProviderId;
	externalId?: string;
}

export interface MemoryRetrieveOptions {
	topK?: number;
	scoreThreshold?: number;
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
}

export interface MemoryProvider {
	readonly name: MemoryProviderId;
	readonly capabilities: MemoryProviderCapabilities;
	storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult>;
	retrieveMemories(query: string, options?: MemoryRetrieveOptions): Promise<MemoryRetrieveResult[]>;
	deleteMemory(memoryId: string): Promise<boolean>;
}
