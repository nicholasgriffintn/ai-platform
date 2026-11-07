import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { hasUserProviderApiKey } from "~/infrastructure/providers/credentials";
import type { IEnv, IUser } from "~/types";

export async function assertSpeechEntitlement(
  env: IEnv,
  user: IUser | undefined,
  provider: string,
): Promise<void> {
  if (hasProEntitlement(user)) {
    return;
  }

  if (user?.id && (await hasUserProviderApiKey({ env, user, providerName: provider }))) {
    return;
  }

  throw new AssistantError(
    "Speech is part of Pro. Upgrade, or add your own key for a voice provider.",
    ErrorType.AUTHORISATION_ERROR,
    403,
  );
}
