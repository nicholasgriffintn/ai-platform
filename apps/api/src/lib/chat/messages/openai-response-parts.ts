import type { MessagePart } from "~/types";
import { isRecord } from "~/utils/objects";

interface HostedToolDefinition {
  name: string;
  label: string;
  outputOnly?: boolean;
  waitsForSeparateOutput?: boolean;
}

const HOSTED_TOOL_DEFINITIONS: Record<string, HostedToolDefinition> = {
  code_interpreter_call: { name: "code_execution", label: "Code execution" },
  computer_call: { name: "computer_use", label: "Computer use" },
  file_search_call: { name: "file_search", label: "File search" },
  image_generation_call: { name: "image_generation", label: "Image generation" },
  local_shell_call: { name: "hosted_shell", label: "Hosted shell" },
  local_shell_call_output: {
    name: "hosted_shell",
    label: "Hosted shell",
    outputOnly: true,
  },
  mcp_call: { name: "mcp", label: "MCP" },
  shell_call: {
    name: "hosted_shell",
    label: "Hosted shell",
    waitsForSeparateOutput: true,
  },
  shell_call_output: { name: "hosted_shell", label: "Hosted shell", outputOnly: true },
  tool_search_call: {
    name: "tool_search",
    label: "Tool search",
    waitsForSeparateOutput: true,
  },
  tool_search_output: { name: "tool_search", label: "Tool search", outputOnly: true },
  web_search_call: { name: "search_grounding", label: "Search grounding" },
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readPayload(value: unknown): string | unknown[] | Record<string, unknown> | undefined {
  if (typeof value === "string" || Array.isArray(value) || isRecord(value)) {
    return value;
  }

  return undefined;
}

function parseArguments(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractToolInput(item: Record<string, unknown>): unknown {
  if (typeof item.code === "string") {
    return { code: item.code };
  }

  if (item.action !== undefined) {
    return item.action;
  }

  if (item.arguments !== undefined) {
    return parseArguments(item.arguments);
  }

  if (Array.isArray(item.queries)) {
    return { queries: item.queries };
  }

  const name = readString(item.name);
  const serverLabel = readString(item.server_label);

  return name || serverLabel ? { name, serverLabel } : undefined;
}

function normaliseCodeInterpreterOutputs(outputs: unknown): unknown {
  if (!Array.isArray(outputs)) {
    return outputs;
  }

  const logs = outputs.map((output) => (isRecord(output) ? readString(output.logs) : undefined));

  if (logs.every((output): output is string => output !== undefined)) {
    return logs.join("\n");
  }

  return outputs;
}

function normaliseShellOutputs(outputs: unknown): unknown {
  if (!Array.isArray(outputs)) {
    return outputs;
  }

  const chunks = outputs.flatMap((output) => {
    if (!isRecord(output)) {
      return [];
    }

    const stdout = readString(output.stdout);
    const stderr = readString(output.stderr);

    if (stdout && stderr) {
      return [stdout, `[stderr]\n${stderr}`];
    }

    if (stdout || stderr) {
      return [stdout ?? stderr];
    }

    const outcome = isRecord(output.outcome) ? output.outcome : undefined;

    if (outcome?.type === "timeout") {
      return ["Command timed out."];
    }

    if (outcome?.type === "exit" && typeof outcome.exit_code === "number") {
      return [`Command completed with exit code ${outcome.exit_code}.`];
    }

    return [];
  });

  return chunks.join("\n");
}

function normaliseToolSearchOutput(tools: unknown): unknown {
  if (!Array.isArray(tools)) {
    return tools;
  }

  return tools
    .map((tool) => {
      if (!isRecord(tool)) {
        return typeof tool === "string" ? tool : undefined;
      }

      const name = readString(tool.name) ?? readString(tool.type) ?? "Unknown tool";
      const description = readString(tool.description);

      return description ? `${name} — ${description}` : name;
    })
    .filter((tool): tool is string => !!tool)
    .join("\n");
}

function extractToolOutput(item: Record<string, unknown>): unknown {
  for (const key of ["outputs", "results", "output"] as const) {
    const payload = readPayload(item[key]);

    if (payload !== undefined) {
      if (item.type === "code_interpreter_call") {
        return normaliseCodeInterpreterOutputs(payload);
      }

      if (item.type === "shell_call_output" || item.type === "local_shell_call_output") {
        return normaliseShellOutputs(payload);
      }

      return payload;
    }
  }

  if (item.type === "tool_search_output") {
    return normaliseToolSearchOutput(item.tools);
  }

  if (item.type !== "image_generation_call") {
    const result = readPayload(item.result);

    if (result !== undefined) {
      return result;
    }
  }

  if (item.type === "web_search_call") {
    return readPayload(item.action);
  }

  if (item.type === "image_generation_call" && item.status === "completed") {
    return "Image generated.";
  }

  return undefined;
}

export function extractOpenAIReasoningSummary(item: unknown): string {
  if (!isRecord(item) || item.type !== "reasoning" || !Array.isArray(item.summary)) {
    return "";
  }

  return item.summary
    .map((entry) => (isRecord(entry) ? readString(entry.text) : undefined))
    .filter((text): text is string => !!text)
    .join("\n");
}

export function buildOpenAIHostedToolParts(
  item: unknown,
  timestamp?: number,
  toolCallIdOverride?: string,
): MessagePart[] {
  if (!isRecord(item) || typeof item.type !== "string") {
    return [];
  }

  const definition = HOSTED_TOOL_DEFINITIONS[item.type];

  if (!definition) {
    return [];
  }

  const toolCallId = toolCallIdOverride ?? readString(item.call_id) ?? readString(item.id);
  const status = readString(item.status) ?? "completed";
  const input = extractToolInput(item);
  const output = extractToolOutput(item);
  const responseType = output === undefined || typeof output === "string" ? "text" : "json";
  const parts: MessagePart[] = [];

  if (!definition.outputOnly) {
    parts.push({
      type: "tool_use",
      name: definition.name,
      toolCallId,
      input:
        typeof input === "string" || Array.isArray(input) || isRecord(input) ? input : undefined,
      timestamp,
    });
  }

  if (status !== "in_progress" && (!definition.waitsForSeparateOutput || output !== undefined)) {
    parts.push({
      type: "tool_result",
      name: definition.name,
      toolCallId,
      status,
      content:
        typeof output === "string" || Array.isArray(output) || isRecord(output)
          ? output
          : undefined,
      data: {
        formattedName: definition.label,
        responseType,
        result: output ?? "",
      },
      timestamp,
    });
  }

  return parts;
}

export function buildOpenAIResponseOutputParts(output: unknown, timestamp?: number): MessagePart[] {
  if (!Array.isArray(output)) {
    return [];
  }

  const parts: MessagePart[] = [];
  const pendingToolCallIds = new Map<string, string[]>();

  for (const item of output) {
    const reasoning = extractOpenAIReasoningSummary(item);

    if (reasoning) {
      parts.push({
        type: "reasoning" as const,
        text: reasoning,
        collapsed: true,
        timestamp,
      });

      continue;
    }

    const hostedParts = buildOpenAIHostedToolParts(item, timestamp);
    const toolUse = hostedParts.find((part) => part.type === "tool_use");
    const toolResult = hostedParts.find((part) => part.type === "tool_result");

    if (toolUse && !toolResult && toolUse.toolCallId) {
      const ids = pendingToolCallIds.get(toolUse.name) ?? [];

      ids.push(toolUse.toolCallId);
      pendingToolCallIds.set(toolUse.name, ids);
    }

    if (!toolUse && toolResult?.name) {
      const pendingIds = pendingToolCallIds.get(toolResult.name);
      const pendingId = pendingIds?.shift();

      if (pendingId) {
        parts.push(...buildOpenAIHostedToolParts(item, timestamp, pendingId));
        continue;
      }
    }

    parts.push(...hostedParts);
  }

  return parts;
}
