import type {
	RealtimeModality,
	RealtimeProviderId,
	RealtimeSessionType,
	RealtimeTranscriptionDelay,
	RealtimeTransport,
} from "@assistant/schemas";

export type {
	RealtimeModality,
	RealtimeSessionType,
	RealtimeTranscriptionDelay,
	RealtimeTransport,
};

export type KnownRealtimeProviderName = RealtimeProviderId;
export type RealtimeProviderName = KnownRealtimeProviderName | (string & {});

export interface RealtimeClientSecret {
	value: string;
	expires_at?: number;
}

export interface RealtimeSession {
	id?: string;
	object?: string;
	type?: RealtimeSessionType | string;
	provider?: RealtimeProviderName;
	transport?: RealtimeTransport;
	protocol?: string;
	model?: string;
	url?: string;
	client_secret?: RealtimeClientSecret;
	input_modalities?: RealtimeModality[];
	output_modalities?: RealtimeModality[];
	modalities?: string[];
	setup?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface CreateRealtimeSessionOptions {
	type: RealtimeSessionType;
	provider?: RealtimeProviderName;
	model?: string;
	transport?: RealtimeTransport;
	inputModalities?: RealtimeModality[];
	outputModalities?: Exclude<RealtimeModality, "image" | "video">[];
	language?: string;
	sourceLanguage?: string;
	targetLanguage?: string;
	voice?: string;
	instructions?: string;
	delay?: RealtimeTranscriptionDelay;
	signal?: AbortSignal;
	timeoutMs?: number | null;
}

export interface RealtimeConnection {
	session: RealtimeSession;
	close: () => void;
}
