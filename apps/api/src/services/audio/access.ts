import { anonymousCreditActor, readCreditPosition } from "@ngriffin_uk/polychat-ai-billing";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { RepositoryManager } from "~/repositories";
import { createUsageStore } from "~/services/usage/runtime";
import type { AnonymousUser, IUser } from "~/types";

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

  const position = await readCreditPosition(
    { store: createUsageStore(repositories) },
    {
      actor: anonymousCreditActor(anonymousUser.id),
    },
  );

  if (position.state === "exhausted") {
    throw new AssistantError(
      "This session's credits are spent. Sign in for a larger allowance.",
      ErrorType.USAGE_LIMIT_ERROR,
    );
  }
}
