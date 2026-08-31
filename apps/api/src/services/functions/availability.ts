import {
  CAPABILITY_DISCOVERY_TOOL_NAME,
  SKILL_LOAD_TOOL_NAME,
  type ToolSelectionMode,
} from "@ngriffin_uk/polychat-schemas";

import type { IUser } from "~/types";
import { intersectEnabledTools } from "~/utils/enabledTools";

const DISCOVERY_FUNCTION_TOOLS = [CAPABILITY_DISCOVERY_TOOL_NAME, SKILL_LOAD_TOOL_NAME] as const;
const SIGNED_IN_FUNCTION_TOOLS = ["web_search"] as const;

export function resolveManagedFunctionToolNames(access: { isSignedIn: boolean }): string[] {
  return access.isSignedIn
    ? [...DISCOVERY_FUNCTION_TOOLS, ...SIGNED_IN_FUNCTION_TOOLS]
    : [...DISCOVERY_FUNCTION_TOOLS];
}

export function resolveEnabledFunctionToolNames(
  requestedToolNames: readonly string[] | undefined,
  user: Pick<IUser, "id" | "plan_id"> | undefined,
): Set<string> {
  if (requestedToolNames !== undefined) {
    return new Set(requestedToolNames);
  }

  return new Set(resolveManagedFunctionToolNames({ isSignedIn: Boolean(user?.id) }));
}

export function resolveRequestFunctionToolNames(params: {
  projectTools?: readonly string[];
  requestedToolNames: readonly string[] | undefined;
  toolSelectionMode: ToolSelectionMode | undefined;
  user: Pick<IUser, "id" | "plan_id"> | undefined;
}): string[] | undefined {
  const { projectTools, requestedToolNames, toolSelectionMode, user } = params;
  const scopedRequestedTools = projectTools
    ? intersectEnabledTools(projectTools, requestedToolNames)
    : requestedToolNames;

  if (toolSelectionMode !== "managed") {
    return scopedRequestedTools ? [...scopedRequestedTools] : undefined;
  }

  const discoveryTools = new Set<string>(DISCOVERY_FUNCTION_TOOLS);
  const baselineTools = resolveManagedFunctionToolNames({
    isSignedIn: Boolean(user?.id),
  }).filter(
    (toolName) => !projectTools || discoveryTools.has(toolName) || projectTools.includes(toolName),
  );

  return [...new Set([...(scopedRequestedTools ?? []), ...baselineTools])];
}
