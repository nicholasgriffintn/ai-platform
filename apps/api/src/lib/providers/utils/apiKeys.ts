import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type { CredentialAuthority, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ProviderApiKeyLogger {
  error(message: string, metadata?: Record<string, unknown>): void;
}

interface ResolveProviderApiKeyOptions {
  env: IEnv;
  providerName: string;
  envKeyName: string;
  userId?: number;
  credentialAuthority?: CredentialAuthority;
  logger?: ProviderApiKeyLogger;
}

interface HasUserProviderApiKeyOptions {
  env: IEnv;
  user?: Pick<IUser, "id">;
  providerName: string;
}

export async function hasUserProviderApiKey({
  env,
  user,
  providerName,
}: HasUserProviderApiKeyOptions): Promise<boolean> {
  if (!user?.id || !env.DB || !providerName.trim()) {
    return false;
  }

  const userSettingsRepo = new UserSettingsRepository(env);

  return userSettingsRepo.hasProviderApiKey(user.id, providerName);
}

export async function resolveProviderApiKey({
  env,
  providerName,
  envKeyName,
  userId,
  credentialAuthority,
  logger,
}: ResolveProviderApiKeyOptions): Promise<string> {
  if (userId && env.DB) {
    const userSettingsRepo = new UserSettingsRepository(env);
    const hasUserApiKey = await userSettingsRepo.hasProviderApiKey(userId, providerName);

    if (hasUserApiKey) {
      try {
        const apiKey = await userSettingsRepo.getProviderApiKey(userId, providerName);

        if (!apiKey) {
          throw new AssistantError(
            `Stored provider API key is unavailable for ${providerName}`,
            ErrorType.CONFIGURATION_ERROR,
          );
        }

        return apiKey;
      } catch (error) {
        logger?.error(`Failed to get user API key for ${providerName}:`, { error });

        throw error;
      }
    }

    if (credentialAuthority === "byok") {
      throw new AssistantError(
        `A user API key is required for ${providerName}`,
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }
  } else if (credentialAuthority === "byok") {
    throw new AssistantError(
      `A user API key is required for ${providerName}`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const envValue = (env as Record<string, unknown>)[envKeyName];

  if (typeof envValue !== "string" || envValue.length === 0) {
    throw new AssistantError(`Missing ${envKeyName}`, ErrorType.CONFIGURATION_ERROR);
  }

  return envValue;
}
