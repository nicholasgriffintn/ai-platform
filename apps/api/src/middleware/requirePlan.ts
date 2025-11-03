import type { Context, Next } from "hono";

import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export type PlanType = "free" | "pro" | "enterprise";

export function requirePlan(requiredPlan: PlanType) {
	return async (context: Context, next: Next) => {
		const user = context.get("user") as IUser | undefined;

		if (!user?.id) {
			throw new AssistantError(
				"User not authenticated",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		if (user.plan_id !== requiredPlan) {
			throw new AssistantError(
				`This feature requires a ${requiredPlan} plan. Your current plan is ${user.plan_id || "free"}.`,
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
