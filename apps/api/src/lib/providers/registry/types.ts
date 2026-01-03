import type { AudioProvider } from "../capabilities/audio";
import type { AIProvider } from "../capabilities/chat/providers/base";
import type { ImageProvider } from "../capabilities/image";
import type { MusicProvider } from "../capabilities/music";
import type { SpeechProvider } from "../capabilities/speech";
import type {
	EmbeddingProvider,
	GuardrailsProvider,
	IEnv,
	IUser,
	ResearchProvider,
	SearchProvider,
} from "~/types";
import type { TranscriptionProvider } from "../capabilities/transcription";
import type { VideoProvider } from "../capabilities/video";

export type ProviderCategory =
	| "audio"
	| "chat"
	| "embedding"
	| "guardrails"
	| "image"
	| "music"
	| "research"
	| "search"
	| "speech"
	| "transcription"
	| "video";

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
	image: ImageProvider;
	music: MusicProvider;
	research: ResearchProvider;
	search: SearchProvider;
	speech: SpeechProvider;
	transcription: TranscriptionProvider;
	video: VideoProvider;
};

export interface ProviderSummary {
	name: string;
	category: ProviderCategory;
	aliases?: string[];
	metadata?: ProviderMetadata;
}
