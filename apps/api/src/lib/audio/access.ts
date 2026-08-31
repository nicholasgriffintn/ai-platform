import { UsageManager } from "~/lib/usageManager";
import type { RepositoryManager } from "~/repositories";
import type { AnonymousUser, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const PLATFORM_HOSTED_SPEECH_PROVIDERS: readonly string[] = ["melotts"];

export interface SpeechAccessOptions {
  repositories: RepositoryManager;
  user?: IUser | null;
  anonymousUser?: AnonymousUser | null;
  provider?: string | null;
}

export function requiresAuthenticatedSpeechProvider(provider?: string | null): boolean {
  if (!provider) {
    return false;
  }

  return !PLATFORM_HOSTED_SPEECH_PROVIDERS.includes(provider);
}

export async function checkSpeechAccess({
  repositories,
  user,
  anonymousUser,
  provider,
}: SpeechAccessOptions): Promise<void> {
  if (user?.id) {
    return;
  }

  if (requiresAuthenticatedSpeechProvider(provider)) {
    throw new AssistantError(
      `Speech generation with ${provider} requires an authenticated account.`,
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  if (!anonymousUser?.id) {
    throw new AssistantError(
      "Speech generation requires an authenticated or anonymous session.",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  await new UsageManager(repositories, null, anonymousUser).checkAnonymousUsage();
}

export async function recordSpeechUsage({
  repositories,
  user,
  anonymousUser,
}: Omit<SpeechAccessOptions, "provider">): Promise<void> {
  if (user?.id || !anonymousUser?.id) {
    return;
  }

  await new UsageManager(repositories, null, anonymousUser).incrementAnonymousUsage();
}
