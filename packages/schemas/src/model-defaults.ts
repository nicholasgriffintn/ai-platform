export interface ModelPolicyReference {
  model: string;
  provider: string;
}

export const MODEL_DEFAULTS = {
  auxiliary: [
    { model: "groq-openai-gpt-oss-20b", provider: "groq" },
    { model: "@cf/zai-org/glm-4.7-flash", provider: "workers-ai" },
  ],
  retrieval: [
    { model: "sonar", provider: "perplexity-ai" },
    { model: "groq-openai-gpt-oss-20b", provider: "groq" },
    { model: "@cf/zai-org/glm-4.7-flash", provider: "workers-ai" },
  ],
  guardrails: [
    { model: "openai/gpt-oss-safeguard-20b", provider: "groq" },
    { model: "@cf/meta/llama-guard-3-8b", provider: "workers-ai" },
  ],
  sandbox: [
    { model: "mistral-large", provider: "mistral" },
    { model: "deepseek-v4-flash", provider: "deepseek" },
  ],
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

function collectModelPolicyReferences(value: object): ModelPolicyReference[] {
  const model = Reflect.get(value, "model");
  const provider = Reflect.get(value, "provider");

  if (typeof model === "string" && typeof provider === "string") {
    return [{ model, provider }];
  }

  return Object.values(value).flatMap((entry) =>
    entry && typeof entry === "object" ? collectModelPolicyReferences(entry) : [],
  );
}

export const MODEL_POLICY_REFERENCES = collectModelPolicyReferences(MODEL_DEFAULTS);

export const DEFAULT_SANDBOX_MODEL = MODEL_DEFAULTS.sandbox[0].model;
