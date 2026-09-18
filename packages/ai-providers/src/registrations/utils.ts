import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv, ProviderUser } from "../env.js";
import type { ProviderFactoryContext } from "../runtime.js";

export function ensureEnv(context: ProviderFactoryContext): ProviderEnv {
  if (!context.env) {
    throw new AssistantError(
      "Provider resolution requires an env context",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return context.env;
}

export function ensureUser(
  context: ProviderFactoryContext,
  options?: { optional?: boolean },
): ProviderUser | undefined {
  if (!context.user && !options?.optional) {
    throw new AssistantError(
      "Provider resolution requires a user context",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return context.user;
}

export function ensureConfig<TConfig = Record<string, unknown>>(
  context: ProviderFactoryContext,
  message?: string,
): TConfig {
  if (!context.config) {
    throw new AssistantError(
      message || "Provider resolution requires configuration",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return context.config as TConfig;
}
