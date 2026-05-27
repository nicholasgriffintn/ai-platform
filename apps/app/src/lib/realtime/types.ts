export type RealtimeSessionType = "realtime" | "translation" | "transcription";
export type RealtimeTransport = "webrtc" | "websocket";
export type RealtimeModality = "text" | "audio" | "image" | "video";
export type KnownRealtimeProviderName = "openai" | "google-ai-studio" | "mistral";
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
	delay?: "minimal" | "low" | "medium" | "high" | "xhigh";
	signal?: AbortSignal;
	timeoutMs?: number | null;
}

export interface RealtimeConnection {
	session: RealtimeSession;
	close: () => void;
}
