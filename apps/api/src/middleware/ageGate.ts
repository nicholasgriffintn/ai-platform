import {
  INTERNAL_SERVICE_AUTHORIZATION_HEADER,
  mentionsCrisis,
  withCrisisSignpost,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseBearerToken } from "@ngriffin_uk/polychat-utility-server/http";
import type { Context, Next } from "hono";

import { resolveAgeGateStatus } from "~/modules/auth/application/ageGate";

async function refuseMessage(context: Context, message: string): Promise<never> {
  const body = await context.req.text().catch(() => "");

  throw new AssistantError(
    mentionsCrisis(body) ? withCrisisSignpost(message) : message,
    ErrorType.FORBIDDEN,
    403,
  );
}

export async function requireAgeCheck(context: Context, next: Next) {
  if (parseBearerToken(context.req.header(INTERNAL_SERVICE_AUTHORIZATION_HEADER))) {
    return next();
  }

  const status = resolveAgeGateStatus(context.env, {
    user: context.get("user"),
    anonymousUser: context.get("anonymousUser"),
  });

  if (status === "pending") {
    return refuseMessage(context, "Add your date of birth before sending messages.");
  }

  if (status === "under_age") {
    return refuseMessage(context, "This account does not meet the minimum age to send messages.");
  }

  return next();
}
