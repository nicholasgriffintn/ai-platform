import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  createResponseRequestSchema,
  itemsToMessages,
  messagesToItems,
  responseStreamEventSchema,
  parseResponseStreamSseBuffer,
  type ChatCompletionResponseBody,
  type ParsedChatCompletionsPortRequest,
  type PlatformResponse,
  type ResponseTool,
  type StoredItem,
} from "@ngriffin_uk/polychat-schemas";
import {
  encodeServerSentEvent,
  encodeServerSentEventDone,
  generateId,
  isRecord,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { SSE_HEADERS } from "~/infrastructure/http/streaming";
import { createResponse } from "~/modules/responses/application/create";
import { ToolCallType, type AnonymousUser, type IUser, type Message, type ToolCall } from "~/types";

import { completionChunk, createModelCompletion } from "./model-port";

export interface ChatCompletionsPortInput {
  context: ServiceContext;
  request: ParsedChatCompletionsPortRequest;
  user?: IUser;
  anonymousUser?: AnonymousUser;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
  platform?: string;
  conversationHint?: string;
}

function isStateless(request: ParsedChatCompletionsPortRequest): boolean {
  return (
    !request.conversation &&
    !request.agent &&
    !request.environment &&
    request.store !== true &&
    !request.response_id &&
    !request.mode
  );
}

function isResponseToolList(
  tools: ParsedChatCompletionsPortRequest["tools"],
): tools is ResponseTool[] {
  return Array.isArray(tools) && tools.some((tool) => !("function" in tool));
}

function toResponseTools(
  tools: ParsedChatCompletionsPortRequest["tools"],
): ResponseTool[] | undefined {
  if (!tools) {
    return undefined;
  }

  if (isResponseToolList(tools)) {
    return tools;
  }

  return tools.map((tool) => ({
    type: "function" as const,
    name: tool.function.name,
    ...(tool.function.description !== undefined ? { description: tool.function.description } : {}),
    ...(tool.function.parameters !== undefined ? { parameters: tool.function.parameters } : {}),
    ...(tool.function.required !== undefined ? { required: tool.function.required } : {}),
    ...(tool.function.strict !== undefined ? { strict: tool.function.strict } : {}),
    ...(tool.function.async !== undefined ? { async: tool.function.async } : {}),
  }));
}

function toCreateResponseRequest(request: ParsedChatCompletionsPortRequest) {
  const systemMessages = request.messages.filter(
    (message) => message.role === "system" || message.role === "developer",
  );
  const instructions = systemMessages
    .map((message) => (typeof message.content === "string" ? message.content : ""))
    .filter(Boolean)
    .join("\n\n");

  return createResponseRequestSchema.parse({
    conversation: request.conversation,
    input: messagesToItems(request.messages.filter((message) => !systemMessages.includes(message))),
    ...(instructions ? { instructions } : {}),
    model: request.model,
    models: request.models,
    provider: request.provider,
    model_tier: request.model_tier,
    agent: request.agent,
    environment: request.environment,
    tools: toResponseTools(request.tools),
    tool_choice: request.tool_choice,
    parallel_tool_calls: request.parallel_tool_calls,
    permission_mode: request.permission_mode,
    mode: request.mode,
    compaction: request.compaction,
    reasoning:
      request.reasoning ??
      (request.reasoning_effort ? { effort: request.reasoning_effort } : undefined),
    sampling: {
      temperature: request.temperature,
      top_p: request.top_p,
      n: request.n,
      seed: request.seed,
      stop: request.stop,
      max_output_tokens: request.max_completion_tokens ?? request.max_tokens,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
      logit_bias: request.logit_bias,
      logprobs: request.logprobs,
      top_logprobs: request.top_logprobs,
    },
    text: {
      format: request.response_format,
      verbosity: request.verbosity,
    },
    budget: request.budget,
    stream: request.stream,
    store: request.store,
    idempotency_key: request.idempotency_key,
    response_id: request.response_id,
    metadata: request.metadata,
  });
}

function outputText(items: StoredItem[]): string | null {
  const texts = items
    .filter((item) => item.type === "message" && item.role === "assistant")
    .map((item) =>
      item.content
        .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
        .join(""),
    )
    .filter(Boolean);

  return texts.length > 0 ? texts.join("\n") : null;
}

export function responseToChatCompletion(
  response: PlatformResponse,
  model: string | undefined,
): ChatCompletionResponseBody {
  const output = response.output ?? [];
  const messages = itemsToMessages(output) as Message[];
  const assistant = messages.filter((message) => message.role === "assistant").at(-1);
  const toolCalls = Array.isArray(assistant?.tool_calls) ? assistant.tool_calls : [];

  return {
    id: response.id,
    log_id: response.id,
    object: "chat.completion",
    created: Date.parse(response.created_at) || Date.now(),
    model: assistant?.model ?? model ?? "",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: outputText(output),
          ...(assistant?.parts ? { parts: assistant.parts } : {}),
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          ...(assistant?.citations ? { citations: assistant.citations } : {}),
          ...(assistant?.data ? { data: assistant.data } : {}),
        },
        finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
      },
      ...messages
        .filter((message) => message.role === "tool")
        .map((message, index) => ({
          index: index + 1,
          message: {
            id: message.id,
            role: "tool" as const,
            name: message.name,
            content: typeof message.content === "string" ? message.content : "",
            tool_call_id: message.tool_call_id,
            ...(message.parts ? { parts: message.parts } : {}),
            ...(message.data ? { data: message.data } : {}),
          },
          finish_reason: "tool_result",
        })),
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    response,
  };
}

function toChunkToolCalls(
  item: Extract<StoredItem, { type: never }> | Record<string, unknown>,
): ToolCall[] {
  if (!isRecord(item) || typeof item.call_id !== "string") {
    return [];
  }

  return [
    {
      id: item.call_id,
      type: ToolCallType.FUNCTION,
      function: {
        name: typeof item.name === "string" ? item.name : "",
        arguments:
          typeof item.arguments === "string"
            ? item.arguments
            : JSON.stringify(item.arguments ?? {}),
      },
    },
  ];
}

export function toChatCompletionChunkStream(
  platformStream: ReadableStream<Uint8Array>,
  model: string | undefined,
): Response {
  const chunkId = `chatcmpl-${generateId()}`;
  const decoder = new TextDecoder();
  let buffer = "";
  let resolvedModel = model ?? "";
  let finished = false;

  const emit = (controller: TransformStreamDefaultController<Uint8Array>, chunk: object) =>
    controller.enqueue(encodeServerSentEvent(chunk));

  const handle = (
    controller: TransformStreamDefaultController<Uint8Array>,
    raw: Record<string, unknown>,
  ) => {
    if (raw.type === "done") {
      return;
    }

    const parsed = responseStreamEventSchema.safeParse(raw);

    if (!parsed.success) {
      return;
    }

    const event = parsed.data;

    switch (event.type) {
      case "response.output_text.delta":
        emit(controller, completionChunk(chunkId, resolvedModel, { content: event.delta }));

        return;
      case "response.reasoning.delta":
        emit(controller, completionChunk(chunkId, resolvedModel, { reasoning: event.delta }));

        return;
      case "response.output_item.added":
        if (event.item.type === "message" && isRecord(event.item.metadata)) {
          const metadataModel = event.item.metadata.model;

          if (typeof metadataModel === "string") {
            resolvedModel = metadataModel;
          }
        }

        return;
      case "response.output_item.done":
        if (event.item.type === "tool_call") {
          emit(
            controller,
            completionChunk(chunkId, resolvedModel, { toolCalls: toChunkToolCalls(event.item) }),
          );
        }

        return;
      case "response.completed":
      case "response.failed":
      case "response.cancelled":
      case "response.incomplete":
      case "response.waiting":
        finished = true;
        emit(controller, {
          ...completionChunk(chunkId, resolvedModel, {
            finishReason: event.type === "response.completed" ? "stop" : undefined,
          }),
          response: event.response,
        });

        return;
      case "response.error":
        emit(controller, { error: event.error, code: event.code });

        return;
      default:
        return;
    }
  };

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const parsed = parseResponseStreamSseBuffer(buffer);

      buffer = parsed.remainingBuffer;

      for (const event of parsed.events) {
        handle(controller, event);
      }
    },
    flush(controller) {
      if (buffer.trim()) {
        for (const event of parseResponseStreamSseBuffer(buffer, { flush: true }).events) {
          handle(controller, event);
        }
      }

      if (!finished) {
        emit(controller, completionChunk(chunkId, resolvedModel, { finishReason: "stop" }));
      }

      controller.enqueue(encodeServerSentEventDone());
    },
  });

  return new Response(platformStream.pipeThrough(transform), { headers: SSE_HEADERS });
}

export async function createChatCompletionThroughPort({
  context,
  request,
  user,
  anonymousUser,
  executionCtx,
  signal,
  platform,
  conversationHint,
}: ChatCompletionsPortInput): Promise<ChatCompletionResponseBody | Response> {
  if (isStateless(request) && user && request.model && !request.models?.length) {
    return createModelCompletion({
      context,
      user,
      request: {
        model: request.model,
        messages: request.messages,
        tools: isResponseToolList(request.tools) ? undefined : request.tools,
        tool_choice: request.tool_choice,
        parallel_tool_calls: request.parallel_tool_calls,
        temperature: request.temperature,
        top_p: request.top_p,
        max_tokens: request.max_tokens,
        max_completion_tokens: request.max_completion_tokens,
        reasoning_effort: request.reasoning_effort ?? request.reasoning?.effort,
        response_format: request.response_format,
        stream: request.stream,
      },
      conversationId: conversationHint ?? "chat-completions",
    });
  }

  const result = await createResponse({
    context,
    request: toCreateResponseRequest(request),
    user,
    anonymousUser,
    executionCtx,
    signal,
    platform,
  });

  if (result instanceof Response) {
    return result.body ? toChatCompletionChunkStream(result.body, request.model) : result;
  }

  return responseToChatCompletion(result, request.model);
}
