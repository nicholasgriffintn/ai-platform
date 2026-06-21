import type { ServiceContext } from "~/lib/context/serviceContext";
import { providerLibrary } from "~/lib/providers/library";
import type { IEnv, IUser, IUserSettings } from "~/types";
import type { MemoryProvider, MemoryProviderId } from "./types";

export interface GetMemoryProviderContext {
	env: IEnv;
	user?: IUser;
	userSettings?: IUserSettings | null;
	serviceContext?: ServiceContext;
}

export function getMemoryProvider({
	env,
	user,
	userSettings,
	serviceContext,
}: GetMemoryProviderContext): MemoryProvider {
	const providerName = (userSettings?.memory_provider || "built-in") as MemoryProviderId;

	return providerLibrary.memory(providerName, {
		env,
		user,
		userSettings,
		serviceContext,
	});
}
