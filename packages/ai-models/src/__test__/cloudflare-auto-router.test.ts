import { getModelsByMode } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getModelConfigById, getProviderModels, modelConfig } from "../catalogue.js";
import {
  CLOUDFLARE_AUTO_ROUTER_MODELS,
  resolveCloudflareAutoRouterModel,
} from "../cloudflare-auto-router.js";

describe("Cloudflare Auto Router reservation limits", () => {
  it("bounds every pinned candidate's token prices and uses safe shared token limits", () => {
    const router = getModelConfigById("cloudflare/auto");

    expect(router).toBeDefined();
    expect(getModelsByMode(modelConfig, "hosted")["cloudflare/auto"]).toBeDefined();
    expect(getProviderModels("cloudflare")["cloudflare/auto"]).toBe(router);

    for (const { gatewayModel } of CLOUDFLARE_AUTO_ROUTER_MODELS) {
      const candidate = resolveCloudflareAutoRouterModel(modelConfig, gatewayModel);

      expect(candidate).toBeDefined();
      expect(router?.costPer1kInputTokens).toBeGreaterThanOrEqual(
        candidate?.costPer1kInputTokens ?? Infinity,
      );
      expect(router?.costPer1kOutputTokens).toBeGreaterThanOrEqual(
        candidate?.costPer1kOutputTokens ?? Infinity,
      );
      expect(router?.contextWindow).toBeLessThanOrEqual(candidate?.contextWindow ?? 0);
      expect(router?.maxTokens).toBeLessThanOrEqual(candidate?.maxTokens ?? 0);
    }
  });
});
