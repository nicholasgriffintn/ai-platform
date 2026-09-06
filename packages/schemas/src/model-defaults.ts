export interface ModelPolicyReference {
  model: string;
  provider: string;
}

export const MODEL_DEFAULTS = {
  ocr: { model: "mistral-ocr-latest", provider: "mistral" },
  image: {
    replicate: { model: "replicate-flux-2-pro", provider: "replicate" },
    workersAi: { model: "flux-2-dev", provider: "workers-ai" },
  },
  video: {
    replicate: { model: "replicate-google-veo-3-1-fast", provider: "replicate" },
    workersAi: { model: "workers-ai-google-veo-3-1-fast", provider: "workers-ai" },
  },
  music: {
    replicate: { model: "replicate-stable-audio", provider: "replicate" },
    workersAi: { model: "workers-ai-minimax-music-2-6", provider: "workers-ai" },
  },
  speech: {
    replicate: { model: "replicate-chatterbox-turbo", provider: "replicate" },
    workersAi: { model: "melotts", provider: "workers-ai" },
  },
} as const satisfies Record<string, unknown>;
