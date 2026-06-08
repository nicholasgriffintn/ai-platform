import type { AudioProvider } from "../capabilities/audio";
import type { AIProvider } from "../capabilities/chat/providers/base";
import type { ImageProvider } from "../capabilities/image";
import type { MessagingProvider } from "../capabilities/messaging";
import type { MusicProvider } from "../capabilities/music";
import type { OcrProvider } from "../capabilities/ocr/types";
import type { RealtimeProvider } from "../capabilities/realtime";
import type { SpeechProvider } from "../capabilities/speech";
import type { ServiceContext } from "~/lib/context/serviceContext";
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
	| "messaging"
	| "music"
	| "ocr"
	| "realtime"
	| "research"
	| "search"
	| "speech"
	| "transcription"
	| "video";

export interface ProviderFactoryContext {
	env?: IEnv;
	user?: IUser;
	serviceContext?: ServiceContext;
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
	messaging: MessagingProvider;
	music: MusicProvider;
	ocr: OcrProvider;
	realtime: RealtimeProvider;
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
