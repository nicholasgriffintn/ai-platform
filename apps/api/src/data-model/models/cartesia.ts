import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "cartesia";

export const cartesiaModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("ink-2", PROVIDER, {
    name: "Ink 2",
    matchingModel: "ink-2",
    description:
      "Cartesia's English realtime speech-to-text model with semantic turn detection.",
    releaseDate: "May 22, 2026",
    modalities: {
      input: ["audio"],
      output: ["text"],
    },
    strengths: ["transcription"],
    supportsRealtimeSession: true,
    supportsStreaming: true,
    hiddenFromDefaultList: true,
  }),
  createModelConfig("ink-whisper", PROVIDER, {
    name: "Ink Whisper",
    matchingModel: "ink-whisper",
    description: "Cartesia streaming speech-to-text model for realtime voice transcription.",
    deprecated: true,
    modalities: {
      input: ["audio"],
      output: ["text"],
    },
    strengths: ["transcription"],
    supportsRealtimeSession: false,
    supportsStreaming: true,
    hiddenFromDefaultList: true,
  }),
]);
