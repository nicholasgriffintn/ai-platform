import type { IUser, IUserSettings } from "~/types";

export const MEMORY_SEARCH_TOOL_NAME = "search_memories";
export const MEMORY_STORE_TOOL_NAME = "store_memory";

type MemoryToolSettings =
  | Pick<IUserSettings, "memories_save_enabled" | "memories_chat_history_enabled">
  | Partial<Pick<IUserSettings, "memories_save_enabled" | "memories_chat_history_enabled">>
  | null
  | undefined;

export interface MemoryPolicy {
  enabled: boolean;
  canRetrieve: boolean;
  canStore: boolean;
  toolNames: string[];
}

export interface MemoryPromptContextInput {
  synthesisText?: string | null;
}

export function resolveMemoryPolicy(params: {
  user?: IUser | null;
  userSettings?: MemoryToolSettings;
  store?: boolean;
}): MemoryPolicy {
  const { user, userSettings, store } = params;
  const canUseMemory = store && Boolean(user?.id) && user?.plan_id === "pro";
  const canRetrieve =
    canUseMemory &&
    Boolean(userSettings?.memories_save_enabled || userSettings?.memories_chat_history_enabled);
  const canStore = canUseMemory && Boolean(userSettings?.memories_save_enabled);
  const toolNames = [
    ...(canRetrieve ? [MEMORY_SEARCH_TOOL_NAME] : []),
    ...(canStore ? [MEMORY_STORE_TOOL_NAME] : []),
  ];

  return {
    enabled: canRetrieve || canStore,
    canRetrieve,
    canStore,
    toolNames,
  };
}

export function getEnabledMemoryToolNames(params: {
  user?: IUser | null;
  userSettings?: MemoryToolSettings;
  store?: boolean;
}): string[] {
  return resolveMemoryPolicy(params).toolNames;
}

export function mergeEnabledMemoryToolNames(params: {
  enabledTools?: readonly string[];
  user?: IUser | null;
  userSettings?: MemoryToolSettings;
  store?: boolean;
}): string[] {
  return Array.from(
    new Set([
      ...(params.enabledTools ?? []),
      ...getEnabledMemoryToolNames({
        user: params.user,
        userSettings: params.userSettings,
        store: params.store,
      }),
    ]),
  );
}

export function buildMemoryPromptContext({ synthesisText }: MemoryPromptContextInput): string {
  if (!synthesisText) {
    return "";
  }

  return `\n\n# Memory Summary\nThe following is a consolidated summary of your long-term memories about this user. Call ${MEMORY_SEARCH_TOOL_NAME} when the turn needs a specific memory this summary does not carry.\n<memory_synthesis>\n${synthesisText}\n</memory_synthesis>`;
}
