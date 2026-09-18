import { hasPlanEntitlement, resolvePlanId, type PlanId } from "@ngriffin_uk/polychat-ai-billing";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type { Context, Next } from "hono";

import type { IUser } from "~/types";

export type PlanType = PlanId;

export function requirePlan(requiredPlan: PlanType) {
  return async (context: Context, next: Next) => {
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      throw new AssistantError("User not authenticated", ErrorType.AUTHENTICATION_ERROR);
    }

    if (!hasPlanEntitlement(user.plan_id, requiredPlan)) {
      throw new AssistantError(
        `This feature requires a ${requiredPlan} plan. Your current plan is ${resolvePlanId(user.plan_id)}.`,
        ErrorType.AUTHORISATION_ERROR,
      );
    }

    await next();
  };
}

export function requireUser() {
  return async (context: Context, next: Next) => {
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      throw new AssistantError(
        "This endpoint requires authentication. Please provide a valid access token.",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    await next();
  };
}
