import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export const CLOUDFLARE_AUTO_ROUTER_MODELS = [
  { gatewayModel: "anthropic/claude-fable-5", provider: "anthropic", model: "claude-fable-5" },
  { gatewayModel: "anthropic/claude-opus-5", provider: "anthropic", model: "claude-opus-5" },
  { gatewayModel: "anthropic/claude-sonnet-5", provider: "anthropic", model: "claude-sonnet-5" },
  { gatewayModel: "openai/gpt-5.6-luna", provider: "openai", model: "gpt-5.6-luna" },
  { gatewayModel: "openai/gpt-5.6-sol", provider: "openai", model: "gpt-5.6-sol" },
  { gatewayModel: "openai/gpt-5.6-terra", provider: "openai", model: "gpt-5.6-terra" },
  { gatewayModel: "xai/grok-4.5", provider: "grok", model: "grok-4.5" },
] as const;

export function resolveCloudflareAutoRouterModel(
  models: ModelConfig,
  routedModel: string,
): ModelConfigItem | undefined {
  const candidate = CLOUDFLARE_AUTO_ROUTER_MODELS.find(
    (entry) => entry.gatewayModel === routedModel,
  );

  return candidate
    ? Object.values(models).find(
        (model) => model.provider === candidate.provider && model.matchingModel === candidate.model,
      )
    : undefined;
}

export function applyCloudflareAutoRouterLimits(models: ModelConfig): ModelConfig {
  const router = models["cloudflare/auto"];

  if (!router) {
    return models;
  }

  const candidates = CLOUDFLARE_AUTO_ROUTER_MODELS.map(({ gatewayModel }) =>
    resolveCloudflareAutoRouterModel(models, gatewayModel),
  );

  if (
    candidates.some(
      (model) =>
        !model ||
        model.costPer1kInputTokens === undefined ||
        model.costPer1kOutputTokens === undefined ||
        !model.contextWindow ||
        !model.maxTokens,
    )
  ) {
    throw new Error("Cloudflare Auto Router candidates require prices and token limits");
  }

  return {
    ...models,
    "cloudflare/auto": {
      ...router,
      contextWindow: Math.min(...candidates.map((model) => model?.contextWindow ?? Infinity)),
      maxTokens: Math.min(...candidates.map((model) => model?.maxTokens ?? Infinity)),
      costPer1kInputTokens: Math.max(
        ...candidates.map((model) => model?.costPer1kInputTokens ?? 0),
      ),
      costPer1kOutputTokens: Math.max(
        ...candidates.map((model) => model?.costPer1kOutputTokens ?? 0),
      ),
    },
  };
}
