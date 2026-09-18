import {
  CAPABILITY_DISCOVERY_TOOL_NAME,
  SKILL_LOAD_TOOL_NAME,
  type ToolSelectionMode,
} from "@ngriffin_uk/polychat-schemas";
import { intersectEnabledTools } from "@ngriffin_uk/polychat-utility-server/enabled-tools";

import type { IUser } from "~/types";

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
    return scopedRequestedTools ? [...scopedRequestedTools] : undefined;
  }

  const discoveryTools = new Set<string>(DISCOVERY_FUNCTION_TOOLS);
  const baselineTools = resolveManagedFunctionToolNames({
    isSignedIn: Boolean(user?.id),
  }).filter(
    (toolName) => !projectTools || discoveryTools.has(toolName) || projectTools.includes(toolName),
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
