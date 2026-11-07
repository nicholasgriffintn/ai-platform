import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { omitJsonSchemaPatterns } from "@ngriffin_uk/polychat-utility-server/json";

import { resolveRequiredMaxTokens } from "../parameters.js";
import type { ChatCompletionParameters } from "../types/index.js";
import { buildOpenAIResponsesBody } from "./openaiResponses.js";
import { toPerplexityAgentToolName } from "./perplexityAgentToolNames.js";

const AGENT_REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh", "max"]);
const AGENT_CONTENT_PART_TYPES = new Set(["input_text", "input_image", "input_file"]);

function toAgentToolName(name: unknown): unknown {
  return typeof name === "string" ? toPerplexityAgentToolName(name) : name;
}

function formatAgentToolChoice(toolChoice: unknown): unknown {
  return isRecord(toolChoice) && toolChoice.type === "function"
    ? { ...toolChoice, name: toAgentToolName(toolChoice.name) }
    : toolChoice;
}

function joinContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .join("");
}

function formatAgentContentParts(content: unknown[]): Record<string, unknown>[] {
  return content.flatMap((part) => {
    if (!isRecord(part) || !AGENT_CONTENT_PART_TYPES.has(String(part.type))) {
      return [];
    }

    const { prompt_cache_breakpoint: _promptCacheBreakpoint, ...agentPart } = part;

    return [agentPart];
  });
}

function formatAgentMessage(item: Record<string, unknown>): Record<string, unknown>[] {
  const { role, content } = item;

  if (role === "assistant") {
    const text = joinContentText(content);

    return text ? [{ type: "message", role, content: text }] : [];
  }

  if (!Array.isArray(content)) {
    return [{ type: "message", role, content }];
  }

  const parts = formatAgentContentParts(content);

  return parts.length ? [{ type: "message", role, content: parts }] : [];
}

function formatAgentInputItem(item: unknown): Record<string, unknown>[] {
  if (!isRecord(item)) {
    return [];
  }

  switch (item.type) {
    case "message":
      return formatAgentMessage(item);
    case "function_call":
      return [
        {
          type: item.type,
          call_id: item.call_id,
          name: toAgentToolName(item.name),
          arguments: item.arguments,
          thought_signature: item.thought_signature,
        },
      ];
    case "function_call_output":
      return [{ type: item.type, call_id: item.call_id, output: item.output }];
    default:
      return [];
  }
}

function formatAgentInput(input: unknown): unknown {
  return Array.isArray(input) ? input.flatMap(formatAgentInputItem) : input;
}

function formatAgentFunctionTools(tools: unknown): Record<string, unknown>[] {
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools.flatMap((tool) =>
    isRecord(tool) && tool.type === "function"
      ? [
          {
            type: tool.type,
            name: toAgentToolName(tool.name),
            description: tool.description,
            parameters: omitJsonSchemaPatterns(tool.parameters),
            strict: tool.strict,
          },
        ]
      : [],
  );
}

function formatAgentReasoning(reasoning: unknown): { effort: string } | undefined {
  return isRecord(reasoning) &&
    typeof reasoning.effort === "string" &&
    AGENT_REASONING_EFFORTS.has(reasoning.effort)
    ? { effort: reasoning.effort }
    : undefined;
}

function formatAgentResponseFormat(
  params: ChatCompletionParameters,
  modelConfig: ModelConfigItem,
): unknown {
  const responseFormat = params.response_format;

  return modelConfig.supportsResponseFormat &&
    responseFormat &&
    "type" in responseFormat &&
    responseFormat.type === "json_schema"
    ? responseFormat
    : undefined;
}

export function buildPerplexityAgentBody(
  params: ChatCompletionParameters,
  modelConfig: ModelConfigItem,
  functionTools: any[] = [],
  streamingParams: Record<string, any> = {},
): Record<string, any> {
  const responsesBody = buildOpenAIResponsesBody(
    params,
    modelConfig,
    functionTools,
    streamingParams,
  );
  const tools = formatAgentFunctionTools(responsesBody.tools);

  return {
    model: responsesBody.model,
    input: formatAgentInput(responsesBody.input),
    instructions: responsesBody.instructions,
    stream: responsesBody.stream,
    temperature: responsesBody.temperature,
    top_p: responsesBody.top_p,
    max_output_tokens: resolveRequiredMaxTokens(params, modelConfig),
    reasoning: formatAgentReasoning(responsesBody.reasoning),
    response_format: formatAgentResponseFormat(params, modelConfig),
    store: responsesBody.store,
    previous_response_id: responsesBody.previous_response_id,
    ...(tools.length
      ? { tools, tool_choice: formatAgentToolChoice(responsesBody.tool_choice) }
      : {}),
  };
}
