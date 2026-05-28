import type {
	CreateRealtimeSessionOptions,
	KnownRealtimeProviderName,
	RealtimeModality,
	RealtimeSession,
	RealtimeTransport,
} from "./types";
import { extractInlineAudioChunks, isRealtimeSetupCompleteMessage } from "./messages";

export type RealtimeLiveProviderId = KnownRealtimeProviderName;

export interface RealtimeLiveWebSocketAudioInputConfig {
	buildAppendMessage: (base64Audio: string) => unknown;
	endMessages?: unknown[];
	endOnMicrophonePause?: boolean;
	waitForFinalEventTypeOnStop?: string;
}

export interface RealtimeLiveWebSocketAudioOutputConfig {
	extractChunks: (payload: unknown) => string[];
	sampleRate: number;
}

export interface RealtimeLiveWebSocketSetupConfig {
	buildMessage: (session: RealtimeSession) => unknown;
	connectedEventLabel: string;
	isCompleteMessage: (payload: unknown) => boolean;
	startingMediaEventLabel: string;
	waitingEventLabel: string;
}

export interface RealtimeLiveWebSocketVideoInputConfig {
	buildFrameMessage: (frame: { data: string; mimeType: "image/jpeg" }) => unknown;
}

export interface RealtimeLiveWebSocketConfig {
	audioInput?: RealtimeLiveWebSocketAudioInputConfig;
	audioOutput?: RealtimeLiveWebSocketAudioOutputConfig;
	closeErrorLabel: string;
	connectedEventLabel: string;
	connectionFailedMessage: string;
	mediaStartFailedMessage: string;
	setup?: RealtimeLiveWebSocketSetupConfig;
	startingMediaEventLabel: string;
	videoInput?: RealtimeLiveWebSocketVideoInputConfig;
}

export interface RealtimeLiveProviderOption {
	id: RealtimeLiveProviderId;
	label: string;
	shortLabel: string;
	transport: RealtimeTransport;
	sessionType: "realtime" | "transcription";
	defaultDelay?: CreateRealtimeSessionOptions["delay"];
	inputModalities: RealtimeModality[];
	outputModalities: Array<Exclude<RealtimeModality, "image" | "video">>;
	description: string;
	defaultModelId: string;
	websocket?: RealtimeLiveWebSocketConfig;
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
		websocket: {
			audioInput: {
				buildAppendMessage: (base64Audio) => ({
					realtimeInput: {
						audio: {
							data: base64Audio,
							mimeType: "audio/pcm;rate=16000",
						},
					},
				}),
				endMessages: [{ realtimeInput: { audioStreamEnd: true } }],
				endOnMicrophonePause: true,
			},
			audioOutput: {
				extractChunks: extractInlineAudioChunks,
				sampleRate: 24000,
			},
			closeErrorLabel: "Gemini Live",
			connectedEventLabel: "Gemini Live connected",
			connectionFailedMessage: "Gemini Live connection failed",
			mediaStartFailedMessage: "Failed to start Gemini Live media",
			setup: {
				buildMessage: (session) => {
					if (!session.setup) {
						throw new Error("Gemini Live session setup missing");
					}

					return { setup: session.setup };
				},
				connectedEventLabel: "Gemini Live connected",
				isCompleteMessage: isRealtimeSetupCompleteMessage,
				startingMediaEventLabel: "Starting Gemini Live media",
				waitingEventLabel: "Waiting for Gemini Live setup",
			},
			startingMediaEventLabel: "Starting Gemini Live media",
			videoInput: {
				buildFrameMessage: (frame) => ({
					realtimeInput: {
						video: {
							data: frame.data,
							mimeType: frame.mimeType,
						},
					},
				}),
			},
		},
	},
	{
		id: "mistral",
		label: "Mistral Realtime",
		shortLabel: "Mistral",
		transport: "websocket",
		sessionType: "transcription",
		defaultDelay: "low",
		inputModalities: ["audio"],
		outputModalities: ["text"],
		description: "Streaming speech-to-text",
		defaultModelId: "voxtral-mini-transcribe-realtime",
		websocket: {
			audioInput: {
				buildAppendMessage: (base64Audio) => ({
					type: "input_audio.append",
					audio: base64Audio,
				}),
				endMessages: [{ type: "input_audio.flush" }, { type: "input_audio.end" }],
				waitForFinalEventTypeOnStop: "transcription.done",
			},
			closeErrorLabel: "Mistral realtime transcription",
			connectedEventLabel: "Mistral realtime transcription connected",
			connectionFailedMessage: "Mistral realtime transcription failed",
			mediaStartFailedMessage: "Failed to start Mistral realtime transcription media",
			startingMediaEventLabel: "Starting Mistral microphone",
		},
	},
];

export const DEFAULT_REALTIME_LIVE_PROVIDER_ID = REALTIME_LIVE_PROVIDER_OPTIONS[0].id;

export function getRealtimeLiveProviderOption(provider: string): RealtimeLiveProviderOption {
	return (
		REALTIME_LIVE_PROVIDER_OPTIONS.find((option) => option.id === provider) ??
		REALTIME_LIVE_PROVIDER_OPTIONS[0]
	);
}

export function getDefaultLiveModelId(provider: string): string {
	return getRealtimeLiveProviderOption(provider).defaultModelId;
}

export function supportsRealtimeLiveVideoInput(provider: string): boolean {
	return Boolean(getRealtimeLiveProviderOption(provider).websocket?.videoInput);
}
