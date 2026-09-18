const MODEL_CONTRACT_OVERRIDES = {
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
