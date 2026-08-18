import { AuthError } from "@ngriffin_uk/auth-core";

import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { createAssistantAppleDirectAuth } from "~/services/auth/sharedAuth";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function handleAppleIdentityTokenSignIn({
  context,
  env,
  identityToken,
  nonce,
  fullName,
}: {
  context?: ServiceContext;
  env?: IEnv;
  identityToken: string;
  nonce: string;
  fullName?: string;
}): Promise<{ user: User; sessionId: string }> {
  const serviceContext = resolveServiceContext({ context, env });
  const clientIds = [
    serviceContext.env.APPLE_WEB_CLIENT_ID,
    serviceContext.env.APPLE_IOS_CLIENT_ID,
  ].filter(isConfiguredClientId);

  if (clientIds.length === 0) {
    throw new AssistantError("Missing Apple Sign in configuration", ErrorType.CONFIGURATION_ERROR);
  }

  try {
    const auth = createAssistantAppleDirectAuth(serviceContext, clientIds);
    const result = await auth.providers.apple.signIn({
      identityToken,
      nonce,
      ...(fullName ? { name: fullName } : {}),
    });

    if (result.status !== "authenticated") {
      throw new TypeError("Apple authentication did not complete.");
    }

    return {
      user: result.session.user.record,
      sessionId: result.session.token,
    };
  } catch (cause) {
    if (
      !(cause instanceof AuthError) ||
      (cause.code !== "invalid_credentials" && cause.code !== "invalid_input")
    ) {
      throw cause;
    }

    throw new AssistantError("Invalid Apple identity token", ErrorType.AUTHENTICATION_ERROR, 401, {
      cause,
    });
  }
}

function isConfiguredClientId(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
