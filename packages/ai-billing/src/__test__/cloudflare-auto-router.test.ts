import { findModelConfigByMatchingModel } from "@ngriffin_uk/polychat-ai-models";
import { normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import { describe, expect, it, vi } from "vitest";

import { userCreditActor } from "../usage/credit-actor.js";
import { recordModelTurnUsage } from "../usage/model-usage.js";
import { createFakeRuntime } from "./fake-usage-store.js";

describe("Cloudflare Auto Router billing", () => {
  it.each([
    ["openai/gpt-5.6-luna", "openai", "gpt-5.6-luna"],
    ["anthropic/claude-sonnet-5", "anthropic", "claude-sonnet-5"],
    ["xai/grok-4.5", "grok", "grok-4.5"],
    ["openai/gpt-4.1", "openai", "gpt-4.1"],
  ])(
    "charges the routed model's rates even when the user has an upstream BYOK key (%s)",
    async (routedModel, provider, model) => {
      const { runtime, store } = createFakeRuntime();

      store.hasProviderApiKey.mockResolvedValue(true);
      runtime.resolveModelConfig = vi.fn(
        async (selectedModel, selectedProvider) =>
          findModelConfigByMatchingModel(selectedModel, selectedProvider) ?? undefined,
      );
      const candidate = findModelConfigByMatchingModel(model, provider);

      expect(candidate).not.toBeNull();

      const outcome = await recordModelTurnUsage(runtime, {
        actor: userCreditActor(7),
        usage: normaliseTokenUsage({ prompt_tokens: 1000, completion_tokens: 100 }),
        rawUsage: {
          prompt_tokens: 1000,
          completion_tokens: 100,
          cloudflare_routed_model: routedModel,
        },
        model: "cloudflare/auto",
        provider: "cloudflare",
        completionId: "conversation-1",
        messageId: "message-1",
      });
      const input = store.insertEventAndApplyBalance.mock.calls.find(
        ([row]) => row.unit === "input_tokens",
      )?.[0];

      expect(outcome).toBe("written");
      expect(input).toMatchObject({
        vendor: candidate?.provider,
        resource: candidate?.matchingModel,
        cost_micros: Math.round((candidate?.costPer1kInputTokens ?? 0) * 1_000_000),
        byok: false,
        billable: true,
        estimated: false,
      });
      expect(store.hasProviderApiKey).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "other/new-model"])(
    "records unpriced routing usage as estimated (%s)",
    async (routedModel) => {
      const { runtime, store } = createFakeRuntime();

      runtime.resolveModelConfig = vi.fn(
        async (model, provider) => findModelConfigByMatchingModel(model, provider) ?? undefined,
      );

      const outcome = await recordModelTurnUsage(runtime, {
        actor: userCreditActor(7),
        usage: normaliseTokenUsage({ prompt_tokens: 5, completion_tokens: 2 }),
        rawUsage: { prompt_tokens: 5, completion_tokens: 2, cloudflare_routed_model: routedModel },
        model: "cloudflare/auto",
        provider: "cloudflare",
        completionId: "conversation-1",
      });

      expect(outcome).toBe("written");
      expect(store.insertEventAndApplyBalance.mock.calls[0]?.[0]).toMatchObject({
        vendor: routedModel ? "other" : "cloudflare",
        resource: routedModel ? "new-model" : "cloudflare/auto",
        estimated: true,
        cost_micros: 0,
        byok: false,
      });
    },
  );
});
