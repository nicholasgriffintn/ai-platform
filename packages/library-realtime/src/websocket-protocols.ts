import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { AudioCommitGateConfig } from "./audio-commit-gate";
import {
  extractRealtimeGoAwayNotice,
  extractInlineAudioChunks,
  extractRealtimeSessionResumptionUpdate,
  isRealtimeSetupCompleteMessage,
  type RealtimeGoAwayNotice,
  type RealtimeSessionResumptionUpdate,
} from "./messages";
import type { RealtimeSession } from "./types";

type RealtimeLiveProviderId = RealtimeLiveProviderDescriptor["id"];

interface RealtimeLiveWebSocketAudioInputBaseConfig {
  commitMessages?: unknown[];
  commitOnServerTurnEnd?: string;
  commitOnSilence?: AudioCommitGateConfig;
  endMessages?: unknown[];
  endOnMicrophonePause?: boolean;
  keepSendingSilenceWhenMuted?: boolean;
  waitForFinalEventTypeOnStop?: string;
  waitForSocketCloseOnStop?: boolean;
}

export type RealtimeLiveWebSocketAudioInputConfig =
  | (RealtimeLiveWebSocketAudioInputBaseConfig & {
      chunkEncoding: "binary";
      buildAppendMessage?: never;
    })
  | (RealtimeLiveWebSocketAudioInputBaseConfig & {
      buildAppendMessage: (base64Audio: string) => unknown;
      chunkEncoding?: "base64-json";
    });

export interface RealtimeLiveWebSocketAudioOutputConfig {
  extractChunks: (payload: unknown) => string[];
  sampleRate: number;
}

export interface RealtimeLiveWebSocketSetupConfig {
  buildMessage: (session: RealtimeSession, resumptionHandle?: string) => unknown;
  connectedEventLabel: string;
  isCompleteMessage: (payload: unknown) => boolean;
  startingMediaEventLabel: string;
  waitingEventLabel: string;
}

export interface RealtimeLiveWebSocketResumptionConfig {
  extractReconnectNotice: (payload: unknown) => RealtimeGoAwayNotice | undefined;
  extractUpdate: (payload: unknown) => RealtimeSessionResumptionUpdate | undefined;
  reconnectingEventLabel: string;
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
  resumption?: RealtimeLiveWebSocketResumptionConfig;
  setup?: RealtimeLiveWebSocketSetupConfig;
  startingMediaEventLabel: string;
  videoInput?: RealtimeLiveWebSocketVideoInputConfig;
}

export function hasServerTurnDetection(session: RealtimeSession): boolean {
  const audio = session.audio;
  const input = isRecord(audio) ? audio.input : undefined;

  return isRecord(input) && isRecord(input.turn_detection);
}

function createBinaryTranscriptionConfig(label: string): RealtimeLiveWebSocketConfig {
  return {
    audioInput: {
      chunkEncoding: "binary",
      endMessages: [{ type: "input_audio.end" }],
      keepSendingSilenceWhenMuted: true,
      waitForSocketCloseOnStop: true,
    },
    closeErrorLabel: `${label} realtime transcription`,
    connectedEventLabel: `${label} realtime transcription connected`,
    connectionFailedMessage: `${label} realtime transcription failed`,
    mediaStartFailedMessage: `Failed to start ${label} realtime transcription media`,
    startingMediaEventLabel: `Starting ${label} microphone`,
  };
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
      buildMessage: (session, resumptionHandle) => {
        if (!session.setup) {
          throw new Error("Gemini Live session setup missing");
        }

        return {
          setup: {
            ...session.setup,
            sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {},
          },
        };
      },
      connectedEventLabel: "Gemini Live connected",
      isCompleteMessage: isRealtimeSetupCompleteMessage,
      startingMediaEventLabel: "Starting Gemini Live media",
      waitingEventLabel: "Waiting for Gemini Live setup",
    },
    resumption: {
      extractReconnectNotice: extractRealtimeGoAwayNotice,
      extractUpdate: extractRealtimeSessionResumptionUpdate,
      reconnectingEventLabel: "Reconnecting Gemini Live",
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
      commitOnServerTurnEnd: "turn.end",
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
  cartesia: createBinaryTranscriptionConfig("Cartesia"),
  greenpt: createBinaryTranscriptionConfig("GreenPT"),
  "workers-ai": createBinaryTranscriptionConfig("Workers AI"),
};
