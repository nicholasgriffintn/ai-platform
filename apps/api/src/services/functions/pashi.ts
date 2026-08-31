import type { PashiClient } from "~/lib/pashi/client";
import { getPashiClient } from "~/lib/pashi/client";
import { runPashiOperations, searchPashiCatalog } from "~/lib/pashi/tool-adapter";
import type { ApiToolDefinition } from "~/types/functions";
import { jsonSchemaToZod } from "~/utils/jsonSchema";

export function createPashiFunctionTools(client?: PashiClient): {
  run_pashi_tools: ApiToolDefinition;
  search_pashi_tools: ApiToolDefinition;
} {
  const search_pashi_tools: ApiToolDefinition = {
    name: "search_pashi_tools",
    description:
      "Search Pashi's live catalogue of generators and converters. Call this before run_pashi_tools to choose an exact tool ID and retrieve its current input fields.",
    type: "normal",
    costPerCall: 0,
    permissions: ["read"],
    inputSchema: jsonSchemaToZod({
      type: "object",
      properties: {
        tool_types: {
          type: "array",
          description:
            "Required Pashi tool categories to search. Pass generator, converter, or both.",
          items: {
            type: "string",
            enum: ["generator", "converter"],
          },
        },
        query: {
          type: "string",
          description:
            "Optional natural-language goal or exact Pashi tool name, such as colour palette or markdown to Jira.",
        },
        limit: {
          type: "integer",
          description: "Maximum matching tools to return.",
          minimum: 1,
          maximum: 25,
          default: 10,
        },
      },
      required: ["tool_types"],
    }),
    execute: async (args, context) =>
      searchPashiCatalog(client ?? getPashiClient(context.env), args),
  };

  const run_pashi_tools: ApiToolDefinition = {
    name: "run_pashi_tools",
    description:
      "Run Pashi generator or text-converter operations sequentially. Discover current tool IDs and fields with search_pashi_tools first. Do not send existing passwords, private keys, access tokens, personal data, or other secrets as input.",
    type: "normal",
    costPerCall: 0,
    permissions: ["read"],
    companionTools: ["search_pashi_tools"],
    inputSchema: jsonSchemaToZod({
      type: "object",
      properties: {
        operations: {
          type: "array",
          description: "Pashi operations to run in the given order.",
          items: {
            type: "object",
            properties: {
              tool_id: {
                type: "string",
                description: "Exact executable Pashi tool ID returned by search_pashi_tools.",
              },
              input: {
                type: "string",
                description: "Primary text input when the selected tool requires it.",
              },
              fields: {
                type: "object",
                description:
                  "Tool-specific string fields exactly as returned by search_pashi_tools.",
                properties: {},
              },
            },
            required: ["tool_id"],
          },
        },
        stop_on_error: {
          type: "boolean",
          description: "Stop after the first failed operation. Defaults to true.",
          default: true,
        },
      },
      required: ["operations"],
    }),
    execute: async (args, context) =>
      runPashiOperations(client ?? getPashiClient(context.env), args),
  };

  return {
    run_pashi_tools,
    search_pashi_tools,
  };
}

export const { run_pashi_tools, search_pashi_tools } = createPashiFunctionTools();
