import { responseOutputText } from "@ngriffin_uk/polychat-library-chat/response-output";
import {
  toolHintsFromEffectClass,
  toToolInputJsonSchema,
  type ToolEffects,
} from "@ngriffin_uk/polychat-library-tools";
import {
  isTerminalResponseStatus,
  JSON_RPC_ERRORS,
  type PlatformResponse,
  type TeammateSummary,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { JsonRpcError } from "@ngriffin_uk/polychat-utility-server/json-rpc";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { startExternalTeammateResponse } from "~/modules/teammates/application/external-runs";
import { listScopedTeammateSummaries } from "~/modules/teammates/application/listing";
import { listFunctionToolDefinitions } from "~/modules/tools/application/catalogue";
import {
  runToolDirectly,
  type DirectToolRunAuthority,
} from "~/modules/tools/application/direct-run";
import { formatFunctionName } from "~/modules/tools/application/functions";
import { getScopedAvailableTools } from "~/modules/tools/application/toolsOperations";

const MCP_PLATFORM = "mcp";
const TEAMMATE_TOOL_PREFIX = "teammate.";
const MCP_AUTHORITY: DirectToolRunAuthority = { trigger: "channel", autonomyLevel: "assistant" };

const teammateMessageSchema = z.object({
  message: z.string().trim().min(1).max(8_000).describe("What you want the teammate to do"),
});

export interface McpPortTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint: boolean; destructiveHint: boolean };
}

export interface McpPortToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface McpPortToolCall {
  name: string;
  arguments: unknown;
  appUrl: string;
}

function annotationsFor(effects: ToolEffects | undefined): McpPortTool["annotations"] {
  if (typeof effects?.effectClass !== "string") {
    return undefined;
  }

  const hints = toolHintsFromEffectClass(effects.effectClass);

  return { readOnlyHint: hints.readOnly === true, destructiveHint: hints.destructive === true };
}

async function listRegistryTools(context: ServiceContext): Promise<McpPortTool[]> {
  const available = new Set((await getScopedAvailableTools(context)).map((tool) => tool.id));

  return listFunctionToolDefinitions()
    .filter((tool) => available.has(tool.name))
    .map((tool) => {
      const annotations = annotationsFor(tool.effects);

      return {
        name: tool.name,
        title: formatFunctionName(tool.name),
        description: tool.description,
        inputSchema: toToolInputJsonSchema(tool.inputSchema),
        ...(annotations ? { annotations } : {}),
      };
    });
}

function teammateTool(teammate: TeammateSummary): McpPortTool {
  return {
    name: `${TEAMMATE_TOOL_PREFIX}${teammate.id}`,
    title: `Ask ${teammate.name}`,
    description: `${teammate.name}${teammate.description ? `, ${teammate.description}` : ""}. Works in its own Polychat conversation with its tools and asks you in Polychat before anything that sends, spends or deletes.`,
    inputSchema: toToolInputJsonSchema(teammateMessageSchema),
  };
}

async function listTeammates(context: ServiceContext): Promise<TeammateSummary[]> {
  return listScopedTeammateSummaries(context, context.requireUser().id);
}

export async function listMcpPortTools(context: ServiceContext): Promise<McpPortTool[]> {
  const [registry, teammates] = await Promise.all([
    listRegistryTools(context),
    listTeammates(context),
  ]);

  return [...registry, ...teammates.map(teammateTool)];
}

function textResult(
  text: string,
  extras: Omit<McpPortToolResult, "content"> = {},
): McpPortToolResult {
  return { content: [{ type: "text", text }], ...extras };
}

function teammateReply(teammate: TeammateSummary, response: PlatformResponse): McpPortToolResult {
  const reply = responseOutputText(response);
  const text = isTerminalResponseStatus(response.status)
    ? reply || `${teammate.name} finished without a reply.`
    : `${teammate.name} is ${response.status.replaceAll("_", " ")}; the reply lands in Polychat.${reply ? `\n\n${reply}` : ""}`;

  return textResult(text, {
    structuredContent: {
      response_id: response.id,
      conversation_id: response.conversation_id,
      status: response.status,
    },
    ...(response.status === "failed" ? { isError: true } : {}),
  });
}

async function callTeammate(
  context: ServiceContext,
  teammateId: string,
  rawArguments: unknown,
): Promise<McpPortToolResult> {
  const teammate = (await listTeammates(context)).find((candidate) => candidate.id === teammateId);

  if (!teammate) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "No teammate with that id");
  }

  const input = teammateMessageSchema.safeParse(rawArguments ?? {});

  if (!input.success) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "Send the teammate a message");
  }

  const response = await startExternalTeammateResponse(context, {
    teammateId,
    text: input.data.message,
    platform: MCP_PLATFORM,
  });

  if (response instanceof Response) {
    throw new JsonRpcError(JSON_RPC_ERRORS.internal, "The teammate answered with a stream");
  }

  return teammateReply(teammate, response);
}

function functionResultText(result: unknown): string {
  if (!isRecord(result)) {
    return "Done.";
  }

  if (typeof result.content === "string" && result.content) {
    return result.content;
  }

  return JSON.stringify(result.data ?? result);
}

async function callRegistryTool(
  context: ServiceContext,
  call: McpPortToolCall,
): Promise<McpPortToolResult> {
  const available = await listRegistryTools(context);

  if (!available.some((tool) => tool.name === call.name)) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, `Unknown tool: ${call.name}`);
  }

  try {
    const run = await runToolDirectly({
      context,
      toolId: call.name,
      args: isRecord(call.arguments) ? call.arguments : {},
      appUrl: call.appUrl,
      platform: MCP_PLATFORM,
      authority: MCP_AUTHORITY,
    });
    const result = run.data.result;

    return textResult(functionResultText(result), {
      structuredContent: { output_id: run.output_id ?? null, result },
      ...(isRecord(result) && result.status === "error" ? { isError: true } : {}),
    });
  } catch (error) {
    if (error instanceof AssistantError) {
      return textResult(error.message, { isError: true });
    }

    throw error;
  }
}

export function callMcpPortTool(
  context: ServiceContext,
  call: McpPortToolCall,
): Promise<McpPortToolResult> {
  return call.name.startsWith(TEAMMATE_TOOL_PREFIX)
    ? callTeammate(context, call.name.slice(TEAMMATE_TOOL_PREFIX.length), call.arguments)
    : callRegistryTool(context, call);
}
