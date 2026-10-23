import { INTERNAL_SERVICE_AUTHORIZATION_HEADER } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type { Context, Next } from "hono";

import { resolveAgeGateStatus } from "~/modules/auth/application/ageGate";

export async function requireAgeCheck(context: Context, next: Next) {
  if (context.req.header(INTERNAL_SERVICE_AUTHORIZATION_HEADER)) {
    return next();
  }

  const status = resolveAgeGateStatus(context.env, {
    user: context.get("user"),
    anonymousUser: context.get("anonymousUser"),
  });

  if (status === "pending") {
    throw new AssistantError(
      "Add your date of birth before sending messages.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (status === "under_age") {
    throw new AssistantError(
      "This account does not meet the minimum age to send messages.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return next();
}
