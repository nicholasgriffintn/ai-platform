import {
  CAPABILITY_DISCOVERY_TOOL_NAME,
  SKILL_LOAD_TOOL_NAME,
} from "@ngriffin_uk/polychat-schemas";

import type { IUser } from "~/types";

const ALWAYS_ENABLED_FUNCTION_TOOLS = [
  CAPABILITY_DISCOVERY_TOOL_NAME,
  SKILL_LOAD_TOOL_NAME,
] as const;
const SIGNED_IN_PRO_FUNCTION_TOOLS = ["trigger_recipe", "use_recipe_connector"] as const;

export function resolveEnabledFunctionToolNames(
  requestedToolNames: readonly string[] | undefined,
  user: Pick<IUser, "id" | "plan_id"> | undefined,
): Set<string> {
  if (requestedToolNames !== undefined) {
    return new Set(requestedToolNames);
  }

  const enabledToolNames = new Set<string>();

  for (const toolName of ALWAYS_ENABLED_FUNCTION_TOOLS) {
    enabledToolNames.add(toolName);
  }

  if (user?.id && user.plan_id === "pro") {
    for (const toolName of SIGNED_IN_PRO_FUNCTION_TOOLS) {
      enabledToolNames.add(toolName);
    }
  }

  return enabledToolNames;
}
