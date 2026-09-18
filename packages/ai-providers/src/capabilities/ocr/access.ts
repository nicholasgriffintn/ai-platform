import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { hasHostUserProviderApiKey } from "../../credentials.js";
import type { ProviderEnv, ProviderUser } from "../../env.js";
import type { ProviderHost } from "../../host.js";

export async function requireOcrAccess(
  host: ProviderHost,
  params: {
    env: ProviderEnv;
    user?: ProviderUser;
    providerName: string;
  },
): Promise<void> {
  if (params.user?.plan_id === "pro") {
    return;
  }

  if (
    await hasHostUserProviderApiKey(host, {
      env: params.env,
      user: params.user,
      providerName: params.providerName,
    })
  ) {
    return;
  }

  throw new AssistantError(
    `OCR requires a configured ${params.providerName} provider key`,
    ErrorType.AUTHORISATION_ERROR,
    403,
  );
}
