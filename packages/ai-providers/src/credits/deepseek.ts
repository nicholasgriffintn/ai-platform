import { z } from "zod";

import { fetchBalanceJson } from "./fetch-balance.js";
import type { ProviderCreditBalance, ProviderCreditBalanceReader } from "./types.js";

const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";

const deepSeekBalanceSchema = z.object({
  is_available: z.boolean(),
  balance_infos: z.array(z.object({ total_balance: z.coerce.number() })),
});

async function readDeepSeekCreditBalance(apiKey: string): Promise<ProviderCreditBalance | null> {
  const body = await fetchBalanceJson("deepseek", DEEPSEEK_BALANCE_URL, { apiKey });

  if (body === null) {
    return null;
  }

  const balance = deepSeekBalanceSchema.parse(body);

  return {
    remaining: balance.is_available
      ? Math.max(0, ...balance.balance_infos.map((info) => info.total_balance))
      : 0,
    resetsAt: null,
  };
}

export const deepSeekCreditBalanceReader: ProviderCreditBalanceReader = {
  envKeyName: "DEEPSEEK_API_KEY",
  read: readDeepSeekCreditBalance,
};
