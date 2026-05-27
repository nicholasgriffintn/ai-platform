import type { KnownRealtimeProviderName, RealtimeModality, RealtimeTransport } from "./types";

export type RealtimeLiveProviderId = KnownRealtimeProviderName;

export interface RealtimeLiveProviderOption {
	id: RealtimeLiveProviderId;
	label: string;
	shortLabel: string;
	transport: RealtimeTransport;
	sessionType: "realtime" | "transcription";
	inputModalities: RealtimeModality[];
	outputModalities: Array<Exclude<RealtimeModality, "image" | "video">>;
	description: string;
	defaultModelId: string;
}

export const REALTIME_LIVE_PROVIDER_OPTIONS: RealtimeLiveProviderOption[] = [
	{
		id: "openai",
		label: "OpenAI Realtime",
		shortLabel: "OpenAI",
		transport: "webrtc",
		sessionType: "realtime",
		inputModalities: ["audio"],
		outputModalities: ["audio"],
		description: "WebRTC voice agent",
		defaultModelId: "gpt-realtime-2",
	},
	{
		id: "google-ai-studio",
		label: "Gemini Live",
		shortLabel: "Gemini",
		transport: "websocket",
		sessionType: "realtime",
		inputModalities: ["audio", "video"],
		outputModalities: ["audio"],
		description: "WebSocket voice and vision",
		defaultModelId: "gemini-3.1-flash-live-preview",
	},
	{
		id: "mistral",
		label: "Mistral Realtime",
		shortLabel: "Mistral",
		transport: "websocket",
		sessionType: "transcription",
		inputModalities: ["audio"],
		outputModalities: ["text"],
		description: "Streaming speech-to-text",
		defaultModelId: "voxtral-mini-transcribe-realtime",
	},
];

export function getRealtimeLiveProviderOption(provider: string): RealtimeLiveProviderOption {
	return (
		REALTIME_LIVE_PROVIDER_OPTIONS.find((option) => option.id === provider) ??
		REALTIME_LIVE_PROVIDER_OPTIONS[0]
	);
}

export function getDefaultLiveModelId(provider: string): string {
	return getRealtimeLiveProviderOption(provider).defaultModelId;
}
