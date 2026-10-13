import z from "zod/v4";

import type {
  chatCompletionToolSchema,
  chatHostedToolSettingsSchema,
} from "../response-command.js";
import { chatToolChoiceSchema } from "../response-command.js";
import { toolIdSchema } from "../tool-ids.js";

const recordSchema = z.record(z.string(), z.unknown());

export const HOSTED_TOOL_TYPES = [
  "web_search",
  "code_interpreter",
  "file_search",
  "computer_use",
  "shell",
  "image_generation",
  "tool_search",
] as const;

export const hostedToolTypeSchema = z.enum(HOSTED_TOOL_TYPES);

export type HostedToolType = z.infer<typeof hostedToolTypeSchema>;

export const builtinToolPolicySchema = z.enum(["enabled", "approved", "denied"]);

export type BuiltinToolPolicy = z.infer<typeof builtinToolPolicySchema>;

export const functionToolSchema = z
  .object({
    type: z.literal("function"),
    name: z.string().min(1),
    description: z.string().optional(),
    parameters: recordSchema.optional(),
    required: z.array(z.string()).optional(),
    strict: z.boolean().optional(),
    async: z.boolean().optional(),
  })
  .strict();

export const builtinToolSchema = z
  .object({
    type: z.literal("builtin"),
    id: toolIdSchema,
    policy: builtinToolPolicySchema.optional(),
  })
  .strict();

export const managedToolsSchema = z.object({ type: z.literal("managed") }).strict();

export const hostedToolSchema = z
  .object({
    type: hostedToolTypeSchema,
    settings: recordSchema.optional(),
  })
  .strict();

export const mcpToolSchema = z
  .object({
    type: z.literal("mcp"),
    servers: z.array(recordSchema).min(1),
  })
  .strict();

export const responseToolSchema = z.discriminatedUnion("type", [
  functionToolSchema,
  builtinToolSchema,
  managedToolsSchema,
  hostedToolSchema,
  mcpToolSchema,
]);

export const responseToolsSchema = z.array(responseToolSchema);

export const responseToolChoiceSchema = chatToolChoiceSchema;

export type FunctionTool = z.infer<typeof functionToolSchema>;
export type BuiltinTool = z.infer<typeof builtinToolSchema>;
export type HostedTool = z.infer<typeof hostedToolSchema>;
export type McpTool = z.infer<typeof mcpToolSchema>;
export type ResponseTool = z.infer<typeof responseToolSchema>;
export type ResponseToolChoice = z.infer<typeof responseToolChoiceSchema>;

export interface ResolvedToolSelection {
  enabledTools?: string[];
  approvedTools?: string[];
  deniedTools?: string[];
  toolSelectionMode?: "managed" | "explicit";
  functionTools?: z.infer<typeof chatCompletionToolSchema>[];
  hostedToolSettings?: z.infer<typeof chatHostedToolSettingsSchema>;
}

const HOSTED_TOOL_IDS: Record<HostedToolType, string> = {
  web_search: "web_search",
  code_interpreter: "code_interpreter",
  file_search: "file_search",
  computer_use: "computer_use",
  shell: "shell",
  image_generation: "image_generation",
  tool_search: "tool_search",
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function resolveToolSelection(tools: ResponseTool[] | undefined): ResolvedToolSelection {
  if (!tools) {
    return {};
  }

  const enabled: string[] = [];
  const approved: string[] = [];
  const denied: string[] = [];
  const functionTools: z.infer<typeof chatCompletionToolSchema>[] = [];
  const hostedToolSettings: Record<string, unknown> = {};
  let managed = false;

  for (const tool of tools) {
    switch (tool.type) {
      case "function":
        functionTools.push({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters ?? {},
            required: tool.required,
            strict: tool.strict,
            async: tool.async,
          },
        });
        break;
      case "builtin":
        if (tool.policy === "denied") {
          denied.push(tool.id);
        } else {
          enabled.push(tool.id);

          if (tool.policy === "approved") {
            approved.push(tool.id);
          }
        }

        break;
      case "managed":
        managed = true;
        break;
      case "mcp":
        hostedToolSettings.mcp_servers = tool.servers;
        enabled.push("mcp");
        break;
      default: {
        const id = HOSTED_TOOL_IDS[tool.type];

        enabled.push(id);

        if (tool.settings) {
          hostedToolSettings[tool.type] = tool.settings;
        }
      }
    }
  }

  return {
    ...(enabled.length > 0 || tools.length > 0 ? { enabledTools: unique(enabled) } : {}),
    ...(approved.length > 0 ? { approvedTools: unique(approved) } : {}),
    ...(denied.length > 0 ? { deniedTools: unique(denied) } : {}),
    toolSelectionMode: managed ? "managed" : "explicit",
    ...(functionTools.length > 0 ? { functionTools } : {}),
    ...(Object.keys(hostedToolSettings).length > 0 ? { hostedToolSettings } : {}),
  };
}

export function buildResponseTools(selection: {
  enabledTools?: readonly string[];
  approvedTools?: readonly string[];
  deniedTools?: readonly string[];
  toolSelectionMode?: "managed" | "explicit";
  functionTools?: readonly z.infer<typeof chatCompletionToolSchema>[];
  hostedToolSettings?: z.infer<typeof chatHostedToolSettingsSchema>;
}): ResponseTool[] | undefined {
  const tools: ResponseTool[] = [];
  const approved = new Set(selection.approvedTools ?? []);
  const hostedSettings = selection.hostedToolSettings ?? {};
  const hostedTypes = new Set<string>(HOSTED_TOOL_TYPES);

  if (selection.toolSelectionMode === "managed") {
    tools.push({ type: "managed" });
  }

  for (const id of selection.enabledTools ?? []) {
    if (hostedTypes.has(id)) {
      const hostedType = id as HostedToolType;
      const settings = hostedSettings[hostedType];

      tools.push({
        type: hostedType,
        ...(settings && typeof settings === "object" ? { settings } : {}),
      });
      continue;
    }

    if (id === "mcp" && Array.isArray(hostedSettings.mcp_servers)) {
      tools.push({ type: "mcp", servers: hostedSettings.mcp_servers });
      continue;
    }

    tools.push({
      type: "builtin",
      id,
      ...(approved.has(id) ? { policy: "approved" as const } : {}),
    });
  }

  for (const id of selection.approvedTools ?? []) {
    if (!selection.enabledTools?.includes(id) && !hostedTypes.has(id)) {
      tools.push({ type: "builtin", id, policy: "approved" });
    }
  }

  for (const id of selection.deniedTools ?? []) {
    tools.push({ type: "builtin", id, policy: "denied" });
  }

  for (const tool of selection.functionTools ?? []) {
    tools.push({
      type: "function",
      name: tool.function.name,
      ...(tool.function.description !== undefined
        ? { description: tool.function.description }
        : {}),
      ...(tool.function.parameters !== undefined ? { parameters: tool.function.parameters } : {}),
      ...(tool.function.required !== undefined ? { required: tool.function.required } : {}),
      ...(tool.function.strict !== undefined ? { strict: tool.function.strict } : {}),
      ...(tool.function.async !== undefined ? { async: tool.function.async } : {}),
    });
  }

  return tools.length > 0 ? tools : undefined;
}
