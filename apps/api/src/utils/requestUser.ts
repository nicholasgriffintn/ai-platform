import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IUser } from "~/types";

export interface RequestUserSource {
	context?: Pick<ServiceContext, "user">;
}

export function resolveRequestUser(source: RequestUserSource): IUser | undefined {
	const contextUser = source.context?.user;
	if (contextUser?.id) {
		return contextUser;
	}

	return undefined;
}
