import {
  hasUserProviderApiKey,
  resolveProviderApiKey,
  type ResolveProviderApiKeyOptions,
} from "./api-keys.js";
import type { ProviderEnv, ProviderUser } from "./env.js";
import type { ProviderHost } from "./host.js";

export type HostProviderApiKeyOptions = Omit<ResolveProviderApiKeyOptions, "env" | "keyStore"> & {
  env: ProviderEnv;
};

export function resolveHostProviderApiKey(
  host: ProviderHost,
  options: HostProviderApiKeyOptions,
): Promise<string> {
  return resolveProviderApiKey({ ...options, keyStore: host.keyStore(options.env) });
}

export function hasHostUserProviderApiKey(
  host: ProviderHost,
  options: { env: ProviderEnv; user?: Pick<ProviderUser, "id">; providerName: string },
): Promise<boolean> {
  return hasUserProviderApiKey({
    userId: options.user?.id,
    providerName: options.providerName,
    keyStore: host.keyStore(options.env),
  });
}
