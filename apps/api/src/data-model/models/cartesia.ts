import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "cartesia";

export const cartesiaModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("ink-whisper", PROVIDER, {
		name: "Ink Whisper",
		matchingModel: "ink-whisper",
		description: "Cartesia streaming speech-to-text model for realtime voice transcription.",
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
