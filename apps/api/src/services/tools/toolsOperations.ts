import type { Tool } from "@ngriffin_uk/polychat-schemas";

import { resolveManagedFunctionToolNames } from "~/services/functions/availability";
import { listFunctionToolDefinitions } from "~/services/functions/definitions";
import { NON_RUNNABLE_FUNCTION_TOOLS } from "~/services/functions/internal-tools";
import { formatFunctionName } from "~/utils/functions";

import { getToolCategory } from "./toolCategories";

function isUserFacingTool(toolName: string): boolean {
  return !NON_RUNNABLE_FUNCTION_TOOLS.has(toolName);
}

export function listCatalogueTools(): Tool[] {
  return listFunctionToolDefinitions()
    .filter((tool) => isUserFacingTool(tool.name))
    .map((tool) => ({
      id: tool.name,
      name: formatFunctionName(tool.name),
      description: tool.description,
      category: getToolCategory(tool.name),
      type: tool.type,
    }));
}

export function getAvailableTools(isPro = false, isSignedIn = false): Tool[] {
  const managedToolNames = new Set(resolveManagedFunctionToolNames({ isSignedIn }));

  return listFunctionToolDefinitions()
    .filter((tool) => isUserFacingTool(tool.name))
    .filter((tool) => {
      if (tool.type === "premium" && !isPro) {
        return false;
      }

      if (tool.type === "byok" && !isSignedIn) {
        return false;
      }

      return true;
    })
    .map((tool) => ({
      id: tool.name,
      name: formatFunctionName(tool.name),
      description: tool.description,
      category: getToolCategory(tool.name),
      isDefault: managedToolNames.has(tool.name),
    }));
}
