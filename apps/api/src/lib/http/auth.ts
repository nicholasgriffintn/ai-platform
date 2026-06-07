import type { Context } from "hono";

import type { AnonymousUser, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export function requireAuthenticatedUser(ctx: Context): IUser {
	const user = ctx.get("user") as IUser | undefined;
	if (!user?.id) {
		throw new AssistantError(
			"This endpoint requires authentication. Please provide a valid access token.",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}
	return user;
}

export function requireAuthenticatedUserOrAnonymous(ctx: Context): {
	user: IUser | undefined;
	anonymousUser: AnonymousUser | undefined;
} {
	const user = ctx.get("user") as IUser | undefined;
	const anonymousUser = ctx.get("anonymousUser") as AnonymousUser | undefined;

	if (!user?.id && !anonymousUser?.id) {
		throw new AssistantError(
			"This endpoint requires authentication. Please provide a valid access token.",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	return { user, anonymousUser };
}
