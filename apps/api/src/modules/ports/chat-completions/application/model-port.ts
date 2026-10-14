import { recordModelTurnUsage, userCreditActor } from "@ngriffin_uk/polychat-ai-billing";
import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  extractUsagePayload,
  normaliseTokenUsage,
  type NormalisedTokenUsage,
} from "@ngriffin_uk/polychat-ai-telemetry";
import type { AgentModelCompletionRequest } from "@ngriffin_uk/polychat-schemas";
import {
  encodeServerSentEvent,
  encodeServerSentEventDone,
  generateId,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { SSE_HEADERS } from "~/infrastructure/http/streaming";
import { consumeProviderStream } from "~/modules/chat/application/agent/provider-stream";
import { resolveExecutableModelForRequest } from "~/modules/chat/application/policy/model-access";
import type { ChatEventSink } from "~/modules/chat/application/streaming/emitter";
import { getAIResponse } from "~/modules/chat/application/streaming/responses";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import type { ChatCompletionParameters, IUser, Message, ToolCall } from "~/types";

interface CompletionChunkFields {
  content?: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  finishReason?: "stop" | "tool_calls";
  usage?: NormalisedTokenUsage | null;
}

export function completionChunk(id: string, model: string, fields: CompletionChunkFields) {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          ...(fields.content !== undefined ? { content: fields.content } : {}),
          ...(fields.reasoning !== undefined ? { reasoning_content: fields.reasoning } : {}),
          ...(fields.toolCalls
            ? {
                tool_calls: fields.toolCalls.map((call, index) => ({
                  index,
                  id: call.id,
                  type: "function",
                  function: { name: call.function.name, arguments: call.function.arguments },
                })),
              }
            : {}),
        },
        finish_reason: fields.finishReason ?? null,
      },
    ],
    ...(fields.usage
      ? {
          usage: {
            prompt_tokens: fields.usage.input_tokens,
            completion_tokens: fields.usage.output_tokens,
            total_tokens: fields.usage.total_tokens,
          },
        }
      : {}),
  };
}

export function toProviderConversation(messages: AgentModelCompletionRequest["messages"]): {
  systemPrompt: string;
  messages: Message[];
} {
  const system: string[] = [];
  const conversation: Message[] = [];

  for (const message of messages) {
    if (message.role === "system" || message.role === "developer") {
      const text = extractTextFromMessageContent(message.content ?? "");

      if (text) {
        system.push(text);
      }

      continue;
    }

    conversation.push({
      role: message.role,
      content: message.content ?? "",
      ...(message.name ? { name: message.name } : {}),
      ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
      ...(message.tool_calls
        ? {
            tool_calls: message.tool_calls.map((call) => ({
              id: call.id,
              type: "function",
              function: {
                name: call.function.name,
                arguments:
                  typeof call.function.arguments === "string"
                    ? call.function.arguments
                    : JSON.stringify(call.function.arguments),
              },
            })),
          }
        : {}),
    });
  }

  return { systemPrompt: system.join("\n\n"), messages: conversation };
}

export async function createModelCompletion(params: {
  context: ServiceContext;
  user: IUser;
  request: AgentModelCompletionRequest;
  conversationId: string;
}): Promise<Response> {
  const { context, user, request } = params;
  const { config: modelConfig } = await resolveExecutableModelForRequest({
    env: context.env,
    user,
    model: request.model,
  });
  const conversation = toProviderConversation(request.messages);
  const completionId = params.conversationId;
  const chatParams: ChatCompletionParameters = {
    model: request.model,
    messages: conversation.messages,
    ...(conversation.systemPrompt ? { system_prompt: conversation.systemPrompt } : {}),
    available_functions: [],
    ...(request.tools ? { tools: request.tools } : {}),
    ...(request.tool_choice ? { tool_choice: request.tool_choice } : {}),
    ...(request.parallel_tool_calls !== undefined
      ? { parallel_tool_calls: request.parallel_tool_calls }
      : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...((request.max_completion_tokens ?? request.max_tokens)
      ? { max_tokens: request.max_completion_tokens ?? request.max_tokens }
      : {}),
    ...(request.reasoning_effort ? { reasoning_effort: request.reasoning_effort } : {}),
    ...(request.response_format ? { response_format: request.response_format } : {}),
    completion_id: completionId,
    stream: true,
    store: false,
    env: context.env,
    context,
  };
  const recordUsage = (usage: NormalisedTokenUsage | null, rawUsage: unknown) =>
    recordModelTurnUsage(
      createUsageRuntime({ env: context.env, repositories: context.repositories }),
      {
        actor: userCreditActor(user.id),
        usage,
        rawUsage,
        model: request.model,
        provider: modelConfig.provider,
        completionId,
        messageId: `agent-model:${generateId()}`,
        conversationId: params.conversationId,
        runId: null,
        runAttempt: null,
      },
    );
  const chunkId = `chatcmpl-${generateId()}`;

  if (request.stream !== true) {
    const response = await getAIResponse({ ...chatParams, stream: false });
    const rawUsage = extractUsagePayload(response);
    const usage = normaliseTokenUsage(rawUsage);
    const toolCalls: ToolCall[] = Array.isArray(response?.tool_calls) ? response.tool_calls : [];

    await recordUsage(usage, rawUsage);

    return Response.json({
      id: chunkId,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content:
              typeof response?.response === "string" && response.response
                ? response.response
                : null,
            ...(toolCalls.length > 0
              ? {
                  tool_calls: toolCalls.map((call) => ({
                    id: call.id,
                    type: "function",
                    function: { name: call.function.name, arguments: call.function.arguments },
                  })),
                }
              : {}),
          },
          finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
        },
      ],
      ...(usage
        ? {
            usage: {
              prompt_tokens: usage.input_tokens,
              completion_tokens: usage.output_tokens,
              total_tokens: usage.total_tokens,
            },
          }
        : {}),
    });
  }

  const providerResponse = await getAIResponse(chatParams);
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const write = (fields: CompletionChunkFields) =>
    writer.write(encodeServerSentEvent(completionChunk(chunkId, request.model, fields)));
  const sink: ChatEventSink = {
    write: async (event) => {
      if (event.type === "response.output_text.delta") {
        await write({ content: event.delta });
      } else if (event.type === "response.reasoning.delta") {
        await write({ reasoning: event.delta });
      }
    },
  };
  const pump = async () => {
    try {
      if (providerResponse instanceof ReadableStream) {
        const turn = await consumeProviderStream(providerResponse, sink, {
          env: context.env,
          model: request.model,
          provider: modelConfig.provider,
          completionId,
          userId: user.id,
          serviceContext: context,
          messageId: chunkId,
        });

        if (turn.toolCalls.length > 0) {
          await write({ toolCalls: turn.toolCalls });
        }

        await write({
          finishReason: turn.toolCalls.length > 0 ? "tool_calls" : "stop",
          usage: turn.usage,
        });
        await recordUsage(turn.usage, turn.rawUsage);
      } else {
        const text =
          typeof providerResponse?.response === "string" ? providerResponse.response : "";
        const toolCalls: ToolCall[] = Array.isArray(providerResponse?.tool_calls)
          ? providerResponse.tool_calls
          : [];
        const rawUsage = extractUsagePayload(providerResponse);
        const usage = normaliseTokenUsage(rawUsage);

        await write({ content: text, ...(toolCalls.length > 0 ? { toolCalls } : {}) });
        await write({ finishReason: toolCalls.length > 0 ? "tool_calls" : "stop", usage });
        await recordUsage(usage, rawUsage);
      }

      await writer.write(encodeServerSentEventDone());
    } catch (error) {
      await writer.write(
        encodeServerSentEvent({
          error: { message: error instanceof Error ? error.message : "Model request failed" },
        }),
      );
    } finally {
      await writer.close();
    }
  };

  const pumping = pump();

  context.executionCtx?.waitUntil(pumping);

  return new Response(readable, { headers: SSE_HEADERS });
}
