import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "cartesia";

export const cartesiaModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("ink-2", PROVIDER, {
    name: "Ink 2",
    matchingModel: "ink-2",
    description: "Cartesia realtime speech-to-text model with built-in turn detection.",
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
