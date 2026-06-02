import {
	DEFAULT_REALTIME_LIVE_PROVIDER_ID,
	REALTIME_LIVE_PROVIDER_MANIFEST,
	type RealtimeLiveProviderManifestItem,
} from "@assistant/schemas";
import type { CreateRealtimeSessionOptions, RealtimeSession, RealtimeTransport } from "./types";
import { extractInlineAudioChunks, isRealtimeSetupCompleteMessage } from "./messages";

export type RealtimeLiveProviderId = RealtimeLiveProviderManifestItem["id"];

export { DEFAULT_REALTIME_LIVE_PROVIDER_ID };

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

export interface RealtimeLiveProviderOption extends RealtimeLiveProviderManifestItem {
	transport: RealtimeTransport;
	defaultDelay?: CreateRealtimeSessionOptions["delay"];
	websocket?: RealtimeLiveWebSocketConfig;
}

const REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG: Partial<
	Record<RealtimeLiveProviderId, RealtimeLiveWebSocketConfig>
> = {
	"google-ai-studio": {
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
	mistral: {
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
};

export const REALTIME_LIVE_PROVIDER_OPTIONS: RealtimeLiveProviderOption[] =
	REALTIME_LIVE_PROVIDER_MANIFEST.map((provider) => ({
		...provider,
		websocket: REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG[provider.id],
	}));

export function getRealtimeLiveProviderOption(provider: string): RealtimeLiveProviderOption {
	return (
		REALTIME_LIVE_PROVIDER_OPTIONS.find((option) => option.id === provider) ??
		REALTIME_LIVE_PROVIDER_OPTIONS[0]
	);
}

export function isRealtimeLiveProviderId(
	provider?: string | null,
): provider is RealtimeLiveProviderId {
	return REALTIME_LIVE_PROVIDER_OPTIONS.some((option) => option.id === provider);
}

export function getRealtimeLiveProviderIdForModel(
	model?: { provider?: string; supportsRealtimeSession?: boolean } | null,
): RealtimeLiveProviderId | undefined {
	if (!model?.supportsRealtimeSession || !isRealtimeLiveProviderId(model.provider)) {
		return undefined;
	}

	return model.provider;
}

export function getDefaultLiveModelId(provider: string): string {
	return getRealtimeLiveProviderOption(provider).defaultModelId;
}

export function supportsRealtimeLiveVideoInput(provider: string): boolean {
	return Boolean(getRealtimeLiveProviderOption(provider).websocket?.videoInput);
}
