import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IUser } from "~/types";

export interface RequestUserSource {
	context?: Pick<ServiceContext, "user">;
	user?: IUser | string | null;
}

export function resolveRequestUser(source: RequestUserSource): IUser | undefined {
	const contextUser = source.context?.user;
	if (contextUser?.id) {
		return contextUser;
	}

	return typeof source.user === "object" && source.user?.id ? source.user : undefined;
}
