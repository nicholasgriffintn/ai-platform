import type { ProviderCreditBalance } from "@ngriffin_uk/polychat-ai-providers";
import { z } from "zod";

const UNREADABLE_BALANCE_RETRY_MS = 15 * 60 * 1000;

export const providerQuotaStateSchema = z.object({
  exhaustedAt: z.string(),
  remaining: z.number().nullable(),
  retryAt: z.string().nullable(),
});

export type ProviderQuotaState = z.infer<typeof providerQuotaStateSchema>;

export function parseProviderQuotaState(value: unknown): ProviderQuotaState | null {
  const parsed = providerQuotaStateSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function buildExhaustedProviderQuota(
  balance: ProviderCreditBalance | null,
  now: Date,
): ProviderQuotaState {
  return {
    exhaustedAt: now.toISOString(),
    remaining: balance?.remaining ?? null,
    retryAt: balance
      ? balance.resetsAt
      : new Date(now.getTime() + UNREADABLE_BALANCE_RETRY_MS).toISOString(),
  };
}

export function isProviderQuotaBlocked(state: ProviderQuotaState | null, now: Date): boolean {
  if (!state) {
    return false;
  }

  return state.retryAt === null || Date.parse(state.retryAt) > now.getTime();
}

export function hasProviderQuotaRecovered(
  state: ProviderQuotaState,
  balance: ProviderCreditBalance | null,
  now: Date,
): boolean {
  if (!isProviderQuotaBlocked(state, now)) {
    return true;
  }

  if (!balance) {
    return state.retryAt === null;
  }

  return state.remaining === null || balance.remaining > state.remaining;
}
