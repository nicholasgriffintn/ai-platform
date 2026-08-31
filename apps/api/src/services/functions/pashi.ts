import type { PashiClient } from "~/lib/pashi/client";
import { getPashiClient } from "~/lib/pashi/client";
import { runPashiOperations, searchPashiCatalog } from "~/lib/pashi/tool-adapter";
import type { ApiToolDefinition } from "~/types/functions";

import {
  run_pashi_tools as run_pashi_toolsDescriptor,
  search_pashi_tools as search_pashi_toolsDescriptor,
} from "./definitions/pashi";

export function createPashiFunctionTools(client?: PashiClient): {
  run_pashi_tools: ApiToolDefinition;
  search_pashi_tools: ApiToolDefinition;
} {
  const search_pashi_tools: ApiToolDefinition = {
    ...search_pashi_toolsDescriptor,
    execute: async (args, context) =>
      searchPashiCatalog(client ?? getPashiClient(context.env), args),
  };

  const run_pashi_tools: ApiToolDefinition = {
    ...run_pashi_toolsDescriptor,
    execute: async (args, context) =>
      runPashiOperations(client ?? getPashiClient(context.env), args),
  };

  return {
    run_pashi_tools,
    search_pashi_tools,
  };
}

export const { run_pashi_tools, search_pashi_tools } = createPashiFunctionTools();
