import {
  hasHostUserProviderApiKey,
  isProviderError,
  resolveHostProviderApiKey,
  type ProviderApiKeyLogger,
} from "@ngriffin_uk/polychat-ai-providers";

import { fromProviderError } from "~/infrastructure/errors";
import type { CredentialAuthority, IEnv, IUser } from "~/types";

import { providerHost } from "./host";

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

export function hasUserProviderApiKey(options: HasUserProviderApiKeyOptions): Promise<boolean> {
  return hasHostUserProviderApiKey(providerHost, options);
}

export async function resolveProviderApiKey(
  options: ResolveProviderApiKeyOptions,
): Promise<string> {
  try {
    return await resolveHostProviderApiKey(providerHost, options);
  } catch (error) {
    throw isProviderError(error) ? fromProviderError(error) : error;
  }
}
