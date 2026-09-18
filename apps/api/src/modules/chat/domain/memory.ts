import { buildMemorySummaryContext } from "@ngriffin_uk/polychat-ai-prompts";

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
  const canUseMemory = store === true && Boolean(user?.id) && user?.plan_id === "pro";
  const canRetrieve =
    canUseMemory &&
    (userSettings?.memories_save_enabled === true ||
      userSettings?.memories_chat_history_enabled === true);
  const canStore = canUseMemory && userSettings?.memories_save_enabled === true;
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
  const enabledMemoryToolNames = getEnabledMemoryToolNames({
    user: params.user,
    userSettings: params.userSettings,
    store: params.store,
  });

  return Array.from(
    new Set([
      ...(params.enabledTools ?? []).filter(
        (toolName) => toolName !== MEMORY_SEARCH_TOOL_NAME && toolName !== MEMORY_STORE_TOOL_NAME,
      ),
      ...enabledMemoryToolNames,
    ]),
  );
}

export function buildMemoryPromptContext({ synthesisText }: MemoryPromptContextInput): string {
  if (!synthesisText) {
    return "";
  }

  return buildMemorySummaryContext({
    synthesisText,
    memorySearchTool: MEMORY_SEARCH_TOOL_NAME,
  });
}
