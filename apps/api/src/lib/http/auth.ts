import type { Context } from "hono";

import type { IUser } from "~/types";
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
