import type { MessagePart } from "~/types";
import { safeParseJson } from "~/utils/json";
import { isRecord } from "~/utils/objects";

interface AnthropicHostedToolDefinition {
  name: string;
  label: string;
}

export interface AnthropicHostedToolState {
  id: string;
  name: string;
  input: unknown;
  inputJson: string;
}

export interface AnthropicSearchGrounding {
  groundingChunks: Array<{ web: { uri: string; title: string } }>;
  webSearchQueries?: string[];
}

const HOSTED_TOOL_NAMES: Record<string, AnthropicHostedToolDefinition> = {
  bash_code_execution: { name: "code_execution", label: "Code execution" },
  code_execution: { name: "code_execution", label: "Code execution" },
  text_editor_code_execution: { name: "code_execution", label: "Code execution" },
  web_fetch: { name: "web_fetch", label: "Web fetch" },
  web_search: { name: "search_grounding", label: "Search grounding" },
};

const RESULT_TYPE_TO_TOOL: Record<string, string> = {
  bash_code_execution_tool_result: "bash_code_execution",
  code_execution_tool_result: "code_execution",
  text_editor_code_execution_tool_result: "text_editor_code_execution",
  web_fetch_tool_result: "web_fetch",
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

function resolveDefinition(name: string): AnthropicHostedToolDefinition {
  return HOSTED_TOOL_NAMES[name] ?? { name, label: name };
}

function isErrorPayload(payload: unknown): payload is Record<string, unknown> {
  return isRecord(payload) && typeof payload.type === "string" && payload.type.endsWith("_error");
}

function formatCodeBlock(value: string): string {
  const fence = value.includes("```") ? "````" : "```";

  return `${fence}text\n${value.trimEnd()}\n${fence}`;
}

function formatCodeExecutionResult(payload: Record<string, unknown>): string {
  const stdout = readString(payload.stdout);
  const stderr = readString(payload.stderr);
  const sections: string[] = [];

  if (stdout) {
    sections.push(`**Standard output**\n\n${formatCodeBlock(stdout)}`);
  }

  if (stderr) {
    sections.push(`**Standard error**\n\n${formatCodeBlock(stderr)}`);
  }

  if (typeof payload.return_code === "number") {
    sections.push(`Exit code: ${payload.return_code}`);
  }

  return sections.join("\n\n") || "Code execution completed without output.";
}

function stripDocumentFrontMatter(value: string): string {
  if (!value.startsWith("---\n")) {
    return value;
  }

  const closingDelimiter = value.indexOf("\n---\n", 4);

  return closingDelimiter === -1 ? value : value.slice(closingDelimiter + 5).trimStart();
}

function formatWebFetchResult(payload: Record<string, unknown>): string {
  const document = isRecord(payload.content) ? payload.content : undefined;
  const source = document && isRecord(document.source) ? document.source : undefined;
  const body = source ? readString(source.data) : undefined;
  const renderedBody = body ? stripDocumentFrontMatter(body) : undefined;
  const title = document ? readString(document.title) : undefined;
  const url = readString(payload.url);
  const sourceLink = url ? `[Source](${url})` : undefined;

  if (renderedBody) {
    return [renderedBody, sourceLink].filter((value): value is string => !!value).join("\n\n");
  }

  return title && url ? `[${title}](${url})` : (title ?? url ?? "");
}

function formatErrorPayload(payload: Record<string, unknown>): string {
  const errorCode = readString(payload.error_code);

  return errorCode ? `Tool error: ${errorCode.replaceAll("_", " ")}.` : "The tool failed.";
}

function formatHostedToolResult(toolName: string, payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (isErrorPayload(payload)) {
    return formatErrorPayload(payload);
  }

  if (!isRecord(payload)) {
    return payload === undefined ? "The tool completed without output." : JSON.stringify(payload);
  }

  if (toolName === "web_fetch") {
    return formatWebFetchResult(payload) || JSON.stringify(payload, null, 2);
  }

  if (HOSTED_TOOL_NAMES[toolName]?.name === "code_execution") {
    return formatCodeExecutionResult(payload);
  }

  return JSON.stringify(payload, null, 2);
}

export function buildAnthropicSearchGrounding(
  block: unknown,
  query?: string,
): AnthropicSearchGrounding | null {
  if (
    !isRecord(block) ||
    block.type !== "web_search_tool_result" ||
    !Array.isArray(block.content)
  ) {
    return null;
  }

  const groundingChunks = block.content.flatMap((result) => {
    if (!isRecord(result)) {
      return [];
    }

    const uri = readString(result.url);
    const title = readString(result.title) ?? uri;

    return uri && title ? [{ web: { uri, title } }] : [];
  });

  if (groundingChunks.length === 0 && !query) {
    return null;
  }

  return {
    groundingChunks,
    ...(query ? { webSearchQueries: [query] } : {}),
  };
}

export function mergeAnthropicSearchGrounding(
  current: unknown,
  incoming: AnthropicSearchGrounding,
): Record<string, unknown> {
  const data = isRecord(current) ? current : {};
  const existing = isRecord(data.searchGrounding) ? data.searchGrounding : {};
  const existingChunks = Array.isArray(existing.groundingChunks) ? existing.groundingChunks : [];
  const existingQueries = Array.isArray(existing.webSearchQueries)
    ? existing.webSearchQueries.filter((query): query is string => typeof query === "string")
    : [];
  const chunksByUrl = new Map<string, { web: { uri: string; title: string } }>();

  for (const chunk of [...existingChunks, ...incoming.groundingChunks]) {
    if (isRecord(chunk) && isRecord(chunk.web)) {
      const uri = readString(chunk.web.uri);
      const title = readString(chunk.web.title) ?? uri;

      if (uri && title) {
        chunksByUrl.set(uri, { web: { uri, title } });
      }
    }
  }

  return {
    ...data,
    searchGrounding: {
      ...existing,
      groundingChunks: [...chunksByUrl.values()],
      webSearchQueries: [...new Set([...existingQueries, ...(incoming.webSearchQueries ?? [])])],
    },
  };
}

function isFailedCodeExecution(toolName: string, payload: unknown): boolean {
  return (
    HOSTED_TOOL_NAMES[toolName]?.name === "code_execution" &&
    isRecord(payload) &&
    typeof payload.return_code === "number" &&
    payload.return_code !== 0
  );
}

export function readAnthropicHostedToolStart(block: unknown): AnthropicHostedToolState | null {
  if (!isRecord(block) || block.type !== "server_tool_use") {
    return null;
  }

  const id = readString(block.id);
  const name = readString(block.name);

  if (!id || !name) {
    return null;
  }

  return { id, name, input: block.input, inputJson: "" };
}

export function buildAnthropicHostedToolUsePart(
  state: AnthropicHostedToolState,
  timestamp?: number,
): MessagePart {
  const definition = resolveDefinition(state.name);
  const streamedInput = state.inputJson ? safeParseJson(state.inputJson) : undefined;
  const input = readPayload(streamedInput) ?? readPayload(state.input);

  return {
    type: "tool_use",
    name: definition.name,
    toolCallId: state.id,
    input,
    timestamp,
  };
}

export function buildAnthropicHostedToolResultPart(
  block: unknown,
  toolNamesById: ReadonlyMap<string, string>,
  timestamp?: number,
): MessagePart | null {
  if (!isRecord(block) || typeof block.type !== "string") {
    return null;
  }

  const fallbackName = RESULT_TYPE_TO_TOOL[block.type];
  const toolCallId = readString(block.tool_use_id);

  if (!fallbackName || !toolCallId) {
    return null;
  }

  const definition = resolveDefinition(toolNamesById.get(toolCallId) ?? fallbackName);
  const providerResult = readPayload(block.content);
  const content = formatHostedToolResult(fallbackName, providerResult);
  const status =
    isErrorPayload(providerResult) || isFailedCodeExecution(fallbackName, providerResult)
      ? "error"
      : "completed";

  return {
    type: "tool_result",
    name: definition.name,
    toolCallId,
    status,
    content,
    data: {
      formattedName: definition.label,
      responseType: "text",
      result: content,
      providerResult,
    },
    timestamp,
  };
}
