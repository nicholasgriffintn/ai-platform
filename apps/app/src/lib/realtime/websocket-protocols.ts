import type { RealtimeLiveProviderManifestItem } from "@assistant/schemas";

import type { AudioCommitGateConfig } from "./audio-commit-gate";
import { extractInlineAudioChunks, isRealtimeSetupCompleteMessage } from "./messages";
import type { RealtimeSession } from "./types";

type RealtimeLiveProviderId = RealtimeLiveProviderManifestItem["id"];

export interface RealtimeLiveWebSocketAudioInputConfig {
	buildAppendMessage: (base64Audio: string) => unknown;
	commitMessages?: unknown[];
	commitOnSilence?: AudioCommitGateConfig;
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

export const REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG: Partial<
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
			commitMessages: [{ type: "input_audio.flush" }],
			commitOnSilence: {
				continueLevelThreshold: 0.045,
				minSpeechMs: 220,
				silenceMs: 420,
				startLevelThreshold: 0.075,
			},
			endMessages: [{ type: "input_audio.flush" }, { type: "input_audio.end" }],
			endOnMicrophonePause: true,
			waitForFinalEventTypeOnStop: "transcription.done",
		},
		closeErrorLabel: "Mistral realtime transcription",
		connectedEventLabel: "Mistral realtime transcription connected",
		connectionFailedMessage: "Mistral realtime transcription failed",
		mediaStartFailedMessage: "Failed to start Mistral realtime transcription media",
		startingMediaEventLabel: "Starting Mistral microphone",
	},
	elevenlabs: {
		audioInput: {
			buildAppendMessage: (base64Audio) => ({
				type: "input_audio.append",
				audio: base64Audio,
			}),
			endMessages: [{ type: "input_audio.flush" }, { type: "input_audio.end" }],
			endOnMicrophonePause: true,
			waitForFinalEventTypeOnStop: "transcription.done",
		},
		closeErrorLabel: "ElevenLabs realtime transcription",
		connectedEventLabel: "ElevenLabs realtime transcription connected",
		connectionFailedMessage: "ElevenLabs realtime transcription failed",
		mediaStartFailedMessage: "Failed to start ElevenLabs realtime transcription media",
		startingMediaEventLabel: "Starting ElevenLabs microphone",
	},
	cartesia: {
		audioInput: {
			buildAppendMessage: (base64Audio) => ({
				type: "input_audio.append",
				audio: base64Audio,
			}),
			endMessages: [{ type: "input_audio.flush" }, { type: "input_audio.end" }],
			waitForFinalEventTypeOnStop: "transcription.done",
		},
		closeErrorLabel: "Cartesia realtime transcription",
		connectedEventLabel: "Cartesia realtime transcription connected",
		connectionFailedMessage: "Cartesia realtime transcription failed",
		mediaStartFailedMessage: "Failed to start Cartesia realtime transcription media",
		startingMediaEventLabel: "Starting Cartesia microphone",
	},
};
