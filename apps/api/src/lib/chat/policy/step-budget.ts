import { resolveModeMaxSteps } from "~/lib/permissions/PermissionChecker";
import { resolveEnabledFunctionToolNames } from "~/services/functions/availability";
import type { ChatMode, CoreChatOptions } from "~/types";

const RECIPE_CHAT_DEFAULT_MAX_STEPS = 4;
const RECIPE_CONNECTOR_DEFAULT_MAX_STEPS = 8;
const RECIPE_CONNECTOR_TOOL_NAME = "use_recipe_connector";

function resolveRequestedSteps(chatOptions: CoreChatOptions): number | undefined {
  if (typeof chatOptions.max_steps === "number") {
    return chatOptions.max_steps;
  }

  const enabledFunctionTools = resolveEnabledFunctionToolNames(
    chatOptions.enabled_tools,
    chatOptions.context?.user,
  );

  if (enabledFunctionTools.has(RECIPE_CONNECTOR_TOOL_NAME)) {
    return RECIPE_CONNECTOR_DEFAULT_MAX_STEPS;
  }

  return chatOptions.options?.recipe ? RECIPE_CHAT_DEFAULT_MAX_STEPS : undefined;
}

export function resolveTurnStepBudget(chatOptions: CoreChatOptions, mode: ChatMode): number {
  return resolveModeMaxSteps(mode, resolveRequestedSteps(chatOptions));
}
