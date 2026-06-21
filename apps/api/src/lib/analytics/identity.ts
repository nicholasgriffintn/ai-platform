import { buildAnalyticsDistinctId as buildSharedAnalyticsDistinctId } from "@assistant/schemas";

import type { AnonymousUser, IUser } from "~/types";

type AnalyticsIdentity = {
	user?: Pick<IUser, "id">;
	anonymousUser?: Pick<AnonymousUser, "id">;
};

export function buildAnalyticsDistinctId({ user, anonymousUser }: AnalyticsIdentity): string {
	return buildSharedAnalyticsDistinctId({
		userId: user?.id,
		anonymousUserId: anonymousUser?.id,
	});
}
