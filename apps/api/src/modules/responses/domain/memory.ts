import { buildMemorySummaryContext } from "@ngriffin_uk/polychat-ai-prompts";
import { authorise } from "@ngriffin_uk/polychat-library-policy";

import type { IUser, IUserSettings } from "~/types";

export const MEMORY_SEARCH_TOOL_NAME = "search_memories";
export const MEMORY_STORE_TOOL_NAME = "store_memory";
export const MEMORY_READ_TOOL_NAME = "read_memory_document";

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
  const context = {
    plan: user?.plan_id ?? "",
    signedIn: Boolean(user?.id),
    store: store === true,
    saveEnabled: userSettings?.memories_save_enabled === true,
    historyEnabled: userSettings?.memories_chat_history_enabled === true,
  };
  const canRetrieve = authorise("memory.retrieve", context).allowed;
  const canStore = authorise("memory.store", context).allowed;
  const toolNames = [
    ...(canRetrieve ? [MEMORY_SEARCH_TOOL_NAME, MEMORY_READ_TOOL_NAME] : []),
    ...(canStore ? [MEMORY_STORE_TOOL_NAME] : []),
  ];

  return {
    enabled: canRetrieve || canStore,
    canRetrieve,
    canStore,
    toolNames,
  };
}

export function mergeEnabledMemoryToolNames(params: {
  enabledTools?: readonly string[];
  policy: MemoryPolicy;
  hasBoundDocuments: boolean;
  fixedToolScope: boolean;
}): string[] {
  const requestedTools = params.enabledTools ?? [];
  const tools = params.fixedToolScope
    ? [...requestedTools]
    : [
        ...requestedTools.filter(
          (name) =>
            name !== MEMORY_SEARCH_TOOL_NAME &&
            name !== MEMORY_STORE_TOOL_NAME &&
            name !== MEMORY_READ_TOOL_NAME,
        ),
        ...params.policy.toolNames,
      ];

  if (params.hasBoundDocuments) {
    tools.push(MEMORY_READ_TOOL_NAME);
  }

  return Array.from(new Set(tools));
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
