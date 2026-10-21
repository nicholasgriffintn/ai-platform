import {
  CALCULATOR_TOOL_NAME,
  CAPABILITY_DISCOVERY_TOOL_NAME,
  CURRENT_TIME_TOOL_NAME,
  SKILL_LOAD_TOOL_NAME,
  USER_INFORMATION_TOOL_NAME,
  type ToolSelectionMode,
} from "@ngriffin_uk/polychat-schemas";
import { intersectEnabledTools } from "@ngriffin_uk/polychat-utility-server/enabled-tools";

import type { IUser, IUserSettings } from "~/types";

const DISCOVERY_FUNCTION_TOOLS = [CAPABILITY_DISCOVERY_TOOL_NAME, SKILL_LOAD_TOOL_NAME] as const;
const SIGNED_IN_FUNCTION_TOOLS = ["web_search", "search_conversations"] as const;
const AMBIENT_FUNCTION_TOOLS = [
  CURRENT_TIME_TOOL_NAME,
  CALCULATOR_TOOL_NAME,
  USER_INFORMATION_TOOL_NAME,
] as const;

const WEB_SEARCH_TOOLS = ["web_search", "search_grounding", "research"] as const;
const SOURCE_SEARCH_TOOLS = ["search_documents", "use_recipe_connector"] as const;
const CHAT_HISTORY_TOOLS = ["search_conversations"] as const;

type CapabilitySettings = Partial<
  Pick<
    IUserSettings,
    "web_search_enabled" | "source_search_enabled" | "memories_chat_history_enabled"
  >
>;

export function resolveSettingsDisabledToolNames(params: {
  userSettings: CapabilitySettings | null | undefined;
  explicitToolNames: readonly string[];
}): string[] {
  const { userSettings, explicitToolNames } = params;
  const explicit = new Set(explicitToolNames);
  const disabled = [
    ...(userSettings?.web_search_enabled === false ? WEB_SEARCH_TOOLS : []),
    ...(userSettings?.source_search_enabled === false ? SOURCE_SEARCH_TOOLS : []),
    ...(userSettings?.memories_chat_history_enabled === true ? [] : CHAT_HISTORY_TOOLS),
  ];

  return disabled.filter((toolName) => !explicit.has(toolName));
}

export function withoutSettingsDisabledTools(
  toolNames: readonly string[],
  settingsDisabledTools: readonly string[],
): string[] {
  return toolNames.filter((toolName) => !settingsDisabledTools.includes(toolName));
}

function withAmbientTools(toolNames: readonly string[]): string[] {
  return [...new Set([...toolNames, ...AMBIENT_FUNCTION_TOOLS])];
}

export function resolveManagedFunctionToolNames(access: { isSignedIn: boolean }): string[] {
  return access.isSignedIn
    ? [...DISCOVERY_FUNCTION_TOOLS, ...AMBIENT_FUNCTION_TOOLS, ...SIGNED_IN_FUNCTION_TOOLS]
    : [...DISCOVERY_FUNCTION_TOOLS, ...AMBIENT_FUNCTION_TOOLS];
}

export function resolveEnabledFunctionToolNames(
  requestedToolNames: readonly string[] | undefined,
  user: Pick<IUser, "id" | "plan_id"> | undefined,
): Set<string> {
  if (requestedToolNames !== undefined) {
    return new Set(withAmbientTools(requestedToolNames));
  }

  return new Set(resolveManagedFunctionToolNames({ isSignedIn: Boolean(user?.id) }));
}

export function resolveRequestFunctionToolNames(params: {
  projectTools?: readonly string[];
  requestedToolNames: readonly string[] | undefined;
  grantedToolNames?: readonly string[];
  toolSelectionMode: ToolSelectionMode | undefined;
  user: Pick<IUser, "id" | "plan_id"> | undefined;
}): string[] | undefined {
  const { projectTools, requestedToolNames, grantedToolNames, toolSelectionMode, user } = params;
  const scopeTools = widenProjectTools(projectTools, grantedToolNames);
  const scopedRequestedTools = scopeTools
    ? intersectEnabledTools(scopeTools, requestedToolNames)
    : requestedToolNames;

  if (toolSelectionMode !== "managed") {
    return scopedRequestedTools ? withAmbientTools(scopedRequestedTools) : undefined;
  }

  const unscopedTools = new Set<string>([...DISCOVERY_FUNCTION_TOOLS, ...AMBIENT_FUNCTION_TOOLS]);
  const baselineTools = resolveManagedFunctionToolNames({
    isSignedIn: Boolean(user?.id),
  }).filter(
    (toolName) => !projectTools || unscopedTools.has(toolName) || projectTools.includes(toolName),
  );

  return [...new Set([...(scopedRequestedTools ?? []), ...baselineTools, ...(projectTools ?? [])])];
}

function widenProjectTools(
  projectTools: readonly string[] | undefined,
  grantedToolNames: readonly string[] | undefined,
): readonly string[] | undefined {
  if (!projectTools || !grantedToolNames?.length) {
    return projectTools;
  }

  return [...new Set([...projectTools, ...grantedToolNames])];
}
