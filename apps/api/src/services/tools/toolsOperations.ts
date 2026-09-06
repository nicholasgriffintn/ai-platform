import type { Tool } from "@ngriffin_uk/polychat-schemas";

import { resolveManagedFunctionToolNames } from "~/services/functions/availability";
import { listFunctionToolDefinitions } from "~/services/functions/definitions";
import { formatFunctionName } from "~/utils/functions";

import { getToolCategory } from "./toolCategories";

export function listCatalogueTools(): Tool[] {
  return listFunctionToolDefinitions().map((tool) => ({
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
