import {
  canReadProviderCreditBalance,
  readProviderCreditBalance,
  type ProviderCreditBalance,
  type ProviderHost,
} from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { KVCache } from "~/infrastructure/cache";
import {
  buildExhaustedProviderQuota,
  hasProviderQuotaRecovered,
  isProviderQuotaBlocked,
} from "~/modules/user/domain/provider-quota";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "modules/user/provider-quota" });

interface ProviderQuotaScope {
  provider: string;
  userId: number;
}

async function clearProviderSettingsCache(env: IEnv, userId: number): Promise<void> {
  if (env.CACHE) {
    await new KVCache(env.CACHE).clearUserModelCache(userId.toString());
  }
}

async function readBalance(
  host: ProviderHost,
  env: IEnv,
  { provider, userId }: ProviderQuotaScope,
): Promise<ProviderCreditBalance | null> {
  try {
    return await readProviderCreditBalance(host, { env, provider, userId });
  } catch (error) {
    logger.warn("Could not read provider credit balance", { provider, userId, error });

    return null;
  }
}

export async function recordProviderQuotaExhausted(
  host: ProviderHost,
  env: IEnv,
  scope: ProviderQuotaScope,
): Promise<void> {
  const { provider, userId } = scope;
  const repository = new UserSettingsRepository(env);
  const quota = buildExhaustedProviderQuota(await readBalance(host, env, scope), new Date());

  await repository.setProviderQuota(userId, provider, quota);
  await clearProviderSettingsCache(env, userId);

  logger.warn("Provider is out of credits; routing around it", {
    provider,
    userId,
    remaining: quota.remaining,
    retryAt: quota.retryAt,
  });
}

async function clearProviderQuota(env: IEnv, { provider, userId }: ProviderQuotaScope) {
  await new UserSettingsRepository(env).setProviderQuota(userId, provider, null);
  await clearProviderSettingsCache(env, userId);
}

export async function syncProviderQuotas(
  host: ProviderHost,
  env: IEnv,
  now = new Date(),
): Promise<void> {
  const quotas = await new UserSettingsRepository(env).listProviderQuotas();

  for (const { userId, providerId: provider, quota } of quotas) {
    const scope = { provider, userId };

    if (!isProviderQuotaBlocked(quota, now)) {
      await clearProviderQuota(env, scope);
      continue;
    }

    if (!canReadProviderCreditBalance(provider)) {
      continue;
    }

    if (hasProviderQuotaRecovered(quota, await readBalance(host, env, scope), now)) {
      await clearProviderQuota(env, scope);
      logger.info("Provider credits are back; routing to it again", scope);
    }
  }
}
