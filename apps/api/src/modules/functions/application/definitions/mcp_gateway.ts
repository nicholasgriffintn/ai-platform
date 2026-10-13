import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import type { FunctionToolDescriptor } from "./types";

export const MCP_LIST_TOOLS_NAME = "mcp_list_tools";
export const MCP_CALL_TOOL_NAME = "mcp_call_tool";
export const MCP_GATEWAY_TOOL_NAMES = [MCP_LIST_TOOLS_NAME, MCP_CALL_TOOL_NAME] as const;

export const mcp_list_tools: FunctionToolDescriptor = {
  name: MCP_LIST_TOOLS_NAME,
  maxIdenticalCalls: 1,
  description:
    "Lists the tools a connected MCP integration offers, with their input schemas. Call this before mcp_call_tool unless you already know the exact tool name and schema.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      integration: {
        type: "string",
        description: "The exact name of a connected MCP integration.",
      },
    },
    required: ["integration"],
  }),
  type: "normal",
  permissions: ["read", "network"],
  effects: { effectClass: "read" },
};

export const mcp_call_tool: FunctionToolDescriptor = {
  name: MCP_CALL_TOOL_NAME,
  description:
    "Runs one tool from a connected MCP integration. Use a tool name and arguments exactly as mcp_list_tools returned them.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      integration: {
        type: "string",
        description: "The exact name of a connected MCP integration.",
      },
      tool: { type: "string", description: "The tool name from mcp_list_tools." },
      arguments: {
        type: "object",
        description: "Arguments matching the tool's input schema. Use {} when it takes none.",
        additionalProperties: true,
      },
    },
    required: ["integration", "tool"],
  }),
  type: "normal",
  permissions: ["network", "write"],
  effects: {
    effectClass: "write",
    destination: (input) =>
      typeof input?.integration === "string" && input.integration.trim()
        ? `mcp:${input.integration.trim().toLowerCase()}`
        : undefined,
  },
};
