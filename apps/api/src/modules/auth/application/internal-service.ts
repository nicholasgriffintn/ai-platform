import type { InternalServiceTokenClaims } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  verifyInternalServiceDelegationJwt,
  verifyInternalServiceJwt,
} from "@ngriffin_uk/polychat-utility-server/internal-service-auth";

import type { IEnv } from "~/types";

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
    return await verifyInternalServiceJwt(token, env.JWT_SECRET.trim());
  } catch {
    try {
      return await verifyInternalServiceDelegationJwt(token, env.JWT_SECRET.trim());
    } catch (cause) {
      throw new AssistantError(
        "Invalid or expired internal service token",
        ErrorType.AUTHENTICATION_ERROR,
        401,
        { cause },
      );
    }
  }
}
