import type { IUser, IUserSettings } from "~/types";

export const MEMORY_SEARCH_TOOL_NAME = "search_memories";
export const MEMORY_STORE_TOOL_NAME = "store_memory";

type MemoryToolSettings =
	| Pick<IUserSettings, "memories_save_enabled" | "memories_chat_history_enabled">
	| Partial<Pick<IUserSettings, "memories_save_enabled" | "memories_chat_history_enabled">>
	| null
	| undefined;

function uniqueToolNames(toolNames: readonly string[]): string[] {
	return Array.from(new Set(toolNames));
}

export function getEnabledMemoryToolNames(params: {
	user?: IUser | null;
	userSettings?: MemoryToolSettings;
	store?: boolean;
}): string[] {
	const { user, userSettings, store } = params;

	if (store === false || !user?.id || user.plan_id !== "pro") {
		return [];
	}

	const tools: string[] = [];
	if (userSettings?.memories_save_enabled || userSettings?.memories_chat_history_enabled) {
		tools.push(MEMORY_SEARCH_TOOL_NAME);
	}

	if (userSettings?.memories_save_enabled) {
		tools.push(MEMORY_STORE_TOOL_NAME);
	}

	return tools;
}

export function mergeEnabledMemoryToolNames(params: {
	enabledTools?: readonly string[];
	user?: IUser | null;
	userSettings?: MemoryToolSettings;
	store?: boolean;
}): string[] {
	return uniqueToolNames([
		...(params.enabledTools ?? []),
		...getEnabledMemoryToolNames({
			user: params.user,
			userSettings: params.userSettings,
			store: params.store,
		}),
	]);
}
