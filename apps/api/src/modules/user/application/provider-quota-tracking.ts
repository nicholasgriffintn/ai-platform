import type { ProviderHost } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isProviderQuotaExhaustedError } from "@ngriffin_uk/polychat-utility-server/provider-errors";

import type { ProviderFactoryContext } from "~/infrastructure/providers/registry/types";

import { recordProviderQuotaExhausted } from "./provider-quota";

const logger = getLogger({ prefix: "modules/user/provider-quota-tracking" });

export function withProviderQuotaTracking<T>(
  host: ProviderHost,
  providerName: string,
  instance: T,
  context: ProviderFactoryContext | undefined,
): T {
  const env = context?.serviceContext?.env ?? context?.env;
  const userId = context?.user?.id ?? context?.serviceContext?.user?.id;

  if (!env?.DB || typeof userId !== "number" || typeof instance !== "object" || !instance) {
    return instance;
  }

  const recordExhaustion = async (error: unknown): Promise<never> => {
    if (isProviderQuotaExhaustedError(error)) {
      await recordProviderQuotaExhausted(host, env, { provider: providerName, userId }).catch(
        (recordError: unknown) =>
          logger.error("Failed to record provider quota exhaustion", {
            providerName,
            userId,
            error: recordError,
          }),
      );
    }

    throw error;
  };

  return new Proxy(instance, {
    get(target, property) {
      const value = Reflect.get(target, property);

      if (typeof value !== "function") {
        return value;
      }

      return (...args: unknown[]) => {
        const result: unknown = Reflect.apply(value, target, args);

        return result instanceof Promise ? result.catch(recordExhaustion) : result;
      };
    },
  });
}
