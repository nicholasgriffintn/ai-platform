import {
  DEFAULT_CAPABILITY_METERS,
  recordCapabilityCall,
  type CapabilityMeterTable,
} from "@ngriffin_uk/polychat-ai-billing";

import type { ProviderCategory, ProviderFactoryContext } from "~/lib/providers/registry/types";
import { createUsageRuntime } from "~/services/usage/runtime";

export function withCapabilityMetering<T>(
  category: ProviderCategory,
  providerName: string,
  instance: T,
  context: ProviderFactoryContext | undefined,
  meters: CapabilityMeterTable = DEFAULT_CAPABILITY_METERS,
): T {
  const methods = meters[category];
  const env = context?.serviceContext?.env ?? context?.env;
  const userId = context?.user?.id ?? context?.serviceContext?.user?.id;

  if (
    !methods ||
    !env?.DB ||
    typeof userId !== "number" ||
    instance === null ||
    typeof instance !== "object"
  ) {
    return instance;
  }

  const target = instance as object;
  const canonicalName =
    typeof (target as { name?: unknown }).name === "string"
      ? (target as { name: string }).name
      : providerName;
  const runtime = createUsageRuntime({
    env,
    repositories: context?.serviceContext?.repositories,
  });
  const runId = context?.serviceContext?.executionRunId;
  const runAttempt = context?.serviceContext?.executionRunAttempt;

  return new Proxy(target, {
    get(currentTarget, prop) {
      const value = Reflect.get(currentTarget, prop);

      if (typeof value !== "function") {
        return value;
      }

      const extractor = typeof prop === "string" ? methods[prop] : undefined;

      if (!extractor) {
        return value.bind(currentTarget);
      }

      return async (...args: unknown[]) => {
        const result = await value.apply(currentTarget, args);

        await recordCapabilityCall(runtime, {
          category,
          providerName: canonicalName,
          userId,
          runId,
          runAttempt,
          args,
          result,
          extractor,
        });

        return result;
      };
    },
  }) as T;
}
