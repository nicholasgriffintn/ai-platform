import {
  DEFERRED_TOOL_LOAD_DEFAULT_LIMIT,
  loadToolsInputSchema,
  LOAD_TOOLS_TOOL_NAME,
} from "@ngriffin_uk/polychat-schemas";

import type { DeferredToolRegistry } from "~/lib/tools/DeferredToolRegistry";
import type { ApiToolDefinition } from "~/types/functions";

const MAX_INDEX_CHARACTERS = 3000;

const BASE_DESCRIPTION =
  "Load the full definitions of tools that are available to this conversation but not yet callable. Search for what you need, then call the tools it returns on the next turn.";

function buildToolIndex(registry: DeferredToolRegistry): string {
  const groups = registry.groups();
  const listed = groups.map((group) => `${group.name} (${group.toolNames.join(", ")})`).join("; ");

  if (listed.length <= MAX_INDEX_CHARACTERS) {
    return listed;
  }

  return groups.map((group) => `${group.name} (${group.toolNames.length} tools)`).join("; ");
}

export function buildLoadToolsDescription(registry: DeferredToolRegistry): string {
  return `${BASE_DESCRIPTION} ${registry.size} tools can be loaded: ${buildToolIndex(registry)}.`;
}

export const load_tools: ApiToolDefinition = {
  name: LOAD_TOOLS_TOOL_NAME,
  description: BASE_DESCRIPTION,
  type: "normal",
  costPerCall: 0,
  permissions: ["read"],
  inputSchema: loadToolsInputSchema,
  execute: async (args, context) => {
    const registry = context.request.deferredTools;

    if (!registry || registry.size === 0) {
      return {
        status: "error",
        name: LOAD_TOOLS_TOOL_NAME,
        content: "This conversation has no deferred tools to load.",
        data: { loaded: [] },
      };
    }

    const matches = registry.search(args.query, args.limit ?? DEFERRED_TOOL_LOAD_DEFAULT_LIMIT);

    if (matches.length === 0) {
      return {
        status: "error",
        name: LOAD_TOOLS_TOOL_NAME,
        content: `No deferred tool matches "${args.query}". Search again with a different term, or answer without one.`,
        data: { loaded: [] },
      };
    }

    const loaded = registry.activate(matches.map((match) => match.name));

    return {
      status: "success",
      name: LOAD_TOOLS_TOOL_NAME,
      content: `Loaded ${loaded.length} tool${loaded.length === 1 ? "" : "s"}: ${loaded
        .map((match) => match.name)
        .join(", ")}. They are callable from your next turn.`,
      data: { loaded },
    };
  },
};
