import type { AudioProvider } from "../capabilities/audio";
import type { AIProvider } from "../capabilities/chat/providers/base";
import type {
	EmbeddingProvider,
	GuardrailsProvider,
	IEnv,
	IUser,
	ResearchProvider,
	SearchProvider,
} from "~/types";
import type { TranscriptionProvider } from "../capabilities/transcription";

export type ProviderCategory =
	| "audio"
	| "chat"
	| "embedding"
	| "guardrails"
	| "research"
	| "search"
	| "transcription";

export interface ProviderFactoryContext {
	env?: IEnv;
	user?: IUser;
	config?: unknown;
	options?: Record<string, unknown>;
}

export interface ProviderMetadata {
	vendor?: string;
	description?: string;
	website?: string;
	models?: string[];
	defaultModel?: string;
	categories?: ProviderCategory[];
	tags?: string[];
}

export type ProviderLifecycle = "singleton" | "transient";

export interface ProviderRegistration<TInstance> {
	name: string;
	aliases?: string[];
	lifecycle?: ProviderLifecycle;
	metadata?: ProviderMetadata;
	create: (context: ProviderFactoryContext) => TInstance;
}

export type CategoryProviderMap = {
	audio: AudioProvider;
	chat: AIProvider;
	embedding: EmbeddingProvider;
	guardrails: GuardrailsProvider;
	research: ResearchProvider;
	search: SearchProvider;
	transcription: TranscriptionProvider;
};

export interface ProviderSummary {
	name: string;
	category: ProviderCategory;
	aliases?: string[];
	metadata?: ProviderMetadata;
}
