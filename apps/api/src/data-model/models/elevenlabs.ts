import type { ModelConfig } from "@assistant/schemas";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "elevenlabs";

export const elevenLabsModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("scribe_v2_realtime", PROVIDER, {
		name: "Scribe v2 Realtime",
		matchingModel: "scribe_v2_realtime",
		description: "ElevenLabs realtime speech-to-text model for low-latency transcription.",
		modalities: {
			input: ["audio"],
			output: ["text"],
		},
		strengths: ["transcription"],
		supportsRealtimeSession: true,
		supportsStreaming: true,
		hiddenFromDefaultList: true,
	}),
]);
