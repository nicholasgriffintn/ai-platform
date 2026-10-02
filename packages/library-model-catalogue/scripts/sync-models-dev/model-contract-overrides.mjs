const CLEF_DECISION_CONTRACT = {
  contextWindow: 65536,
  maxTokens: 0,
  modalities: { input: ["text"], output: ["decision"] },
  supportsToolCalls: false,
  supportsAttachments: false,
  supportsTemperature: false,
  costPer1kOutputTokens: 0,
};

const MODEL_CONTRACT_OVERRIDES = {
  "workers-ai": {
    "@cf/cloudflare/clef": { ...CLEF_DECISION_CONTRACT, costPer1kInputTokens: 0.00024 },
    "@cf/cloudflare/clef-flash": { ...CLEF_DECISION_CONTRACT, costPer1kInputTokens: 0.00009 },
  },
  openai: {
    "gpt-5.3-codex": {
      reasoningConfig: {
        supportedEffortLevels: ["low", "medium", "high", "xhigh"],
        defaultEffort: "medium",
      },
    },
  },
};

export function applyModelContractOverrides(values, provider, modelId) {
  const override = MODEL_CONTRACT_OVERRIDES[provider]?.[modelId];

  return override ? { ...values, ...override } : values;
}
