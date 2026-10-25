import { resolveHostProviderApiKey } from "../credentials.js";
import type { ProviderEnv } from "../env.js";
import type { ProviderHost } from "../host.js";
import { deepSeekCreditBalanceReader } from "./deepseek.js";
import { elevenLabsCreditBalanceReader } from "./elevenlabs.js";
import { openRouterCreditBalanceReader } from "./openrouter.js";
import type { ProviderCreditBalance, ProviderCreditBalanceReader } from "./types.js";

export type { ProviderCreditBalance } from "./types.js";

const CREDIT_BALANCE_READERS: Record<string, ProviderCreditBalanceReader> = {
  deepseek: deepSeekCreditBalanceReader,
  elevenlabs: elevenLabsCreditBalanceReader,
  openrouter: openRouterCreditBalanceReader,
};

export function canReadProviderCreditBalance(provider: string): boolean {
  return provider in CREDIT_BALANCE_READERS;
}

export async function readProviderCreditBalance(
  host: ProviderHost,
  { env, provider, userId }: { env: ProviderEnv; provider: string; userId: number },
): Promise<ProviderCreditBalance | null> {
  const reader = CREDIT_BALANCE_READERS[provider];

  if (!reader) {
    return null;
  }

  const apiKey = await resolveHostProviderApiKey(host, {
    env,
    providerName: provider,
    envKeyName: reader.envKeyName,
    userId,
  });

  return reader.read(apiKey);
}
