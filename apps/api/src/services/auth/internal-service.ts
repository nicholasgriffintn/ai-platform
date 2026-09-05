import { importHmacSecret, verifyJwt } from "@ngriffin_uk/auth-jwt";
import {
  INTERNAL_SERVICE_TOKEN_AUDIENCE,
  INTERNAL_SERVICE_TOKEN_TTL_SECONDS,
  internalServiceTokenClaimsSchema,
  type InternalServiceTokenClaims,
} from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function verifyInternalServiceToken(
  env: IEnv,
  token: string,
): Promise<InternalServiceTokenClaims> {
  if (!env.JWT_SECRET?.trim()) {
    throw new AssistantError(
      "Internal service authentication is not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  try {
    const claims = await verifyJwt(token, {
      algorithms: ["HS256"],
      audience: INTERNAL_SERVICE_TOKEN_AUDIENCE,
      issuer: "assistant",
      key: await importHmacSecret(env.JWT_SECRET.trim()),
      maxTokenAgeSeconds: INTERNAL_SERVICE_TOKEN_TTL_SECONDS,
    });
    const parsed = internalServiceTokenClaimsSchema.safeParse(claims);

    if (!parsed.success) {
      throw new Error("Internal service token claims are invalid");
    }

    return parsed.data;
  } catch (cause) {
    if (cause instanceof AssistantError) {
      throw cause;
    }

    throw new AssistantError(
      "Invalid or expired internal service token",
      ErrorType.AUTHENTICATION_ERROR,
      401,
      { cause },
    );
  }
}
