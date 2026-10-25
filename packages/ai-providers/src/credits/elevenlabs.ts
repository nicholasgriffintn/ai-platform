import { z } from "zod";

import { fetchBalanceJson } from "./fetch-balance.js";
import type { ProviderCreditBalance, ProviderCreditBalanceReader } from "./types.js";

const ELEVENLABS_SUBSCRIPTION_URL = "https://api.elevenlabs.io/v1/user/subscription";

const elevenLabsSubscriptionSchema = z.object({
  character_count: z.number(),
  character_limit: z.number(),
  next_character_count_reset_unix: z.number().nullish(),
});

async function readElevenLabsCreditBalance(apiKey: string): Promise<ProviderCreditBalance | null> {
  const body = await fetchBalanceJson("elevenlabs", ELEVENLABS_SUBSCRIPTION_URL, {
    headers: { "xi-api-key": apiKey },
  });

  if (body === null) {
    return null;
  }

  const subscription = elevenLabsSubscriptionSchema.parse(body);
  const resetUnix = subscription.next_character_count_reset_unix;

  return {
    remaining: Math.max(0, subscription.character_limit - subscription.character_count),
    resetsAt: resetUnix ? new Date(resetUnix * 1000).toISOString() : null,
  };
}

export const elevenLabsCreditBalanceReader: ProviderCreditBalanceReader = {
  envKeyName: "ELEVENLABS_API_KEY",
  read: readElevenLabsCreditBalance,
};
