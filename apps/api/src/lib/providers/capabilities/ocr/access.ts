import { hasUserProviderApiKey } from "~/lib/providers/utils/apiKeys";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function requireOcrAccess(params: {
  env: IEnv;
  user?: IUser;
  providerName: string;
}): Promise<void> {
  if (params.user?.plan_id === "pro") {
    return;
  }

  if (
    await hasUserProviderApiKey({
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
