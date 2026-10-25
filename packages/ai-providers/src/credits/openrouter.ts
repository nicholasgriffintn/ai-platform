import { z } from "zod";

import { fetchBalanceJson } from "./fetch-balance.js";
import type { ProviderCreditBalance, ProviderCreditBalanceReader } from "./types.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";

const openRouterCreditsSchema = z.object({
  data: z.object({ total_credits: z.number(), total_usage: z.number() }),
});

const openRouterKeySchema = z.object({
  data: z.object({ limit_remaining: z.number().nullable() }),
});

async function readOpenRouterCreditBalance(apiKey: string): Promise<ProviderCreditBalance | null> {
  const [credits, key] = await Promise.all([
    fetchBalanceJson("openrouter", `${OPENROUTER_API_URL}/credits`, { apiKey }),
    fetchBalanceJson("openrouter", `${OPENROUTER_API_URL}/key`, { apiKey }),
  ]);

  if (credits === null || key === null) {
    return null;
  }

  const account = openRouterCreditsSchema.parse(credits).data;
  const keyRemaining = openRouterKeySchema.parse(key).data.limit_remaining;
  const accountRemaining = Math.max(0, account.total_credits - account.total_usage);

  return {
    remaining: keyRemaining === null ? accountRemaining : Math.min(accountRemaining, keyRemaining),
    resetsAt: null,
  };
}

export const openRouterCreditBalanceReader: ProviderCreditBalanceReader = {
  envKeyName: "OPENROUTER_API_KEY",
  read: readOpenRouterCreditBalance,
};
