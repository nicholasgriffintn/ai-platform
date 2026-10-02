import { modelConfig, resolveCloudflareAutoRouterModel } from "@ngriffin_uk/polychat-ai-models";
import { normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import { describe, expect, it, vi } from "vitest";

import { userCreditActor } from "../usage/credit-actor.js";
import { recordModelTurnUsage } from "../usage/model-usage.js";
import { createFakeRuntime } from "./fake-usage-store.js";

describe("Cloudflare Auto Router billing", () => {
  it.each(["openai/gpt-5.6-luna", "anthropic/claude-sonnet-5", "xai/grok-4.5"])(
    "charges the routed model's rates even when the user has an upstream BYOK key (%s)",
    async (routedModel) => {
      const { runtime, store } = createFakeRuntime();

      store.hasProviderApiKey.mockResolvedValue(true);
      const candidate = resolveCloudflareAutoRouterModel(modelConfig, routedModel);

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

  it("refuses to price router usage using the conservative reservation rates", async () => {
    const { runtime, store } = createFakeRuntime();

    runtime.resolveModelConfig = vi.fn(async () => modelConfig["cloudflare/auto"]);

    const outcome = await recordModelTurnUsage(runtime, {
      actor: userCreditActor(7),
      usage: normaliseTokenUsage({ prompt_tokens: 5, completion_tokens: 2 }),
      model: "cloudflare/auto",
      provider: "cloudflare",
      completionId: "conversation-1",
    });

    expect(outcome).toBe("failed");
    expect(store.insertEventAndApplyBalance).not.toHaveBeenCalled();
    expect(runtime.resolveModelConfig).not.toHaveBeenCalled();
  });
});
