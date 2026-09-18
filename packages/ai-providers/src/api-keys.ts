import { ProviderError } from "./errors";
import type { PlatformEnv } from "./platform-credentials";

export type CredentialAuthority = "platform" | "byok";

export interface ProviderKeyStore {
  hasProviderApiKey(userId: number, providerName: string): Promise<boolean>;
  getProviderApiKey(userId: number, providerName: string): Promise<string | null | undefined>;
}

export interface ProviderApiKeyLogger {
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface ResolveProviderApiKeyOptions {
  env: PlatformEnv;
  providerName: string;
  envKeyName: string;
  userId?: number;
  keyStore?: ProviderKeyStore;
  credentialAuthority?: CredentialAuthority;
  logger?: ProviderApiKeyLogger;
}

export interface HasUserProviderApiKeyOptions {
  userId?: number;
  providerName: string;
  keyStore?: ProviderKeyStore;
}

function byokRequired(providerName: string): ProviderError {
  return new ProviderError(
    "credential_required",
    `A user API key is required for ${providerName}`,
    { providerName },
  );
}

export async function hasUserProviderApiKey({
  userId,
  providerName,
  keyStore,
}: HasUserProviderApiKeyOptions): Promise<boolean> {
  if (!userId || !keyStore || !providerName.trim()) {
    return false;
  }

  return keyStore.hasProviderApiKey(userId, providerName);
}

export async function resolveProviderApiKey({
  env,
  providerName,
  envKeyName,
  userId,
  keyStore,
  credentialAuthority,
  logger,
}: ResolveProviderApiKeyOptions): Promise<string> {
  if (userId && keyStore) {
    if (await keyStore.hasProviderApiKey(userId, providerName)) {
      try {
        const apiKey = await keyStore.getProviderApiKey(userId, providerName);

        if (!apiKey) {
          throw new ProviderError(
            "credential_unavailable",
            `Stored provider API key is unavailable for ${providerName}`,
            { providerName },
          );
        }

        return apiKey;
      } catch (error) {
        logger?.error(`Failed to get user API key for ${providerName}:`, { error });

        throw error;
      }
    }

    if (credentialAuthority === "byok") {
      throw byokRequired(providerName);
    }
  } else if (credentialAuthority === "byok") {
    throw byokRequired(providerName);
  }

  const envValue = env[envKeyName];

  if (typeof envValue !== "string" || envValue.length === 0) {
    throw new ProviderError("credential_missing", `Missing ${envKeyName}`, { providerName });
  }

  return envValue;
}
