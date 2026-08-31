import type { ExecutionContext } from "@cloudflare/workers-types";
import type { ChatCompletionRequestBody } from "@ngriffin_uk/polychat-schemas";

import { processChatRequest } from "~/lib/chat/core";
import { formatAssistantMessage } from "~/lib/chat/messages/assistant-format";
import { buildMessageParts } from "~/lib/chat/messages/parts";
import {
  toProviderMessages,
  toProviderResponseMessagePartSource,
  toProviderResponseMessages,
} from "~/lib/chat/messages/provider-mapping";
import { buildChatPostProcessing } from "~/lib/chat/streaming/post-processing";
import { createServiceContext } from "~/lib/context/serviceContext";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { sseResponse } from "~/lib/http/streaming";
import { replayApprovedConnectorOperation } from "~/services/apps/connectors/approved-operation-replay";
import { withThreadLock } from "~/services/conversations/coordinator/client";
import type {
  AnonymousUser,
  ChatCompletionParameters,
  CreateChatCompletionsResponse,
  IEnv,
  IUser,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { prependConnectorReplayToStream } from "./connectorApprovalReplayResponse";
import { normaliseChatCompletionRequest } from "./normaliseChatCompletionRequest";

const logger = getLogger({
  prefix: "services/completions/createChatCompletions",
});

export const handleCreateChatCompletions = async (req: {
  env: IEnv;
  request: ChatCompletionRequestBody | Omit<ChatCompletionParameters, "env">;
  user?: IUser;
  anonymousUser?: AnonymousUser;
  app_url?: string;
  context?: ServiceContext;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
}): Promise<CreateChatCompletionsResponse | Response> => {
  const { env, request, user, anonymousUser, app_url, context, executionCtx, signal } = req;
  const serviceContext = context ?? createServiceContext({ env, user });
  const chatRequest = normaliseChatCompletionRequest(request);
  const isStreaming = !!request.stream;
  let providerMessages = toProviderMessages(chatRequest.messages);
  let connectorReplay: Awaited<ReturnType<typeof replayApprovedConnectorOperation>> | undefined;

  if (providerMessages.length === 0 && !chatRequest.connector_approval_id) {
    throw new AssistantError("Missing required parameter: messages", ErrorType.PARAMS_ERROR);
  }

  const completionIdWithFallback = request.completion_id || `chat_${generateId()}`;

  if (chatRequest.connector_approval_id && !user?.id) {
    throw new AssistantError(
      "Connector approval requires an authenticated user",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  if (user?.id && chatRequest.connector_approval_id) {
    const approval = await serviceContext.repositories.connectorOperationApprovals.getByIdForUser(
      chatRequest.connector_approval_id,
      user.id,
    );

    if (
      !approval ||
      (approval.state !== "approved" && approval.state !== "consumed") ||
      (approval.state === "approved" && approval.expiresAt <= new Date().toISOString()) ||
      approval.completionId !== completionIdWithFallback
    ) {
      throw new AssistantError(
        "Connector approval is invalid or expired",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    serviceContext.ensureDatabase();
    const conversationManager = ConversationManager.getInstance({
      database: serviceContext.database,
      repositories: serviceContext.repositories,
      user,
      model: chatRequest.model,
      provider: chatRequest.provider,
      platform: chatRequest.platform,
      store: true,
      env,
      requestCache: serviceContext.requestCache,
    });

    connectorReplay = await withThreadLock(
      { env, conversationId: completionIdWithFallback, kind: "connector_replay" },
      () =>
        replayApprovedConnectorOperation({
          approval,
          context: serviceContext,
          conversationManager,
          user,
          model: chatRequest.model,
          appUrl: app_url,
          signal,
        }),
    );
    providerMessages = toProviderMessages(connectorReplay.summaryMessages);
  }

  const result = await processChatRequest({
    ...chatRequest,
    messages: providerMessages,
    app_url,
    env,
    anonymousUser,
    completion_id: completionIdWithFallback,
    stream: isStreaming,
    ...(connectorReplay
      ? {
          disable_functions: true,
          conversation_history_write_mode: "append",
          connector_approval_id: undefined,
          approved_tools: [],
        }
      : {}),
    location: "location" in request ? request.location || undefined : undefined,
    context: serviceContext,
    executionCtx,
  });

  if ("validation" in result) {
    const assistantMessage = formatAssistantMessage({
      content: result.error,
      model: result.selectedModel,
      guardrails: {
        passed: false,
        error: result.error,
      },
      log_id: env.AI.aiGatewayLogId,
      finish_reason: "content_filter",
    });

    return {
      id: env.AI.aiGatewayLogId || completionIdWithFallback,
      log_id: env.AI.aiGatewayLogId,
      object: "chat.completion",
      created: Date.now(),
      model: result.selectedModel,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: assistantMessage.content,
          },
          finish_reason: assistantMessage.finish_reason,
        },
      ],
      usage: assistantMessage.usage,
      post_processing: {
        guardrails: assistantMessage.guardrails,
      },
    };
  }

  if (isStreaming && "stream" in result) {
    return sseResponse(
      connectorReplay
        ? prependConnectorReplayToStream({
            stream: result.stream,
            toolCall: connectorReplay.toolCall,
            toolResult: connectorReplay.toolResult,
          })
        : result.stream,
    );
  }

  if (!("response" in result)) {
    logger.error("Unexpected result shape from processChatRequest:", result);
    throw new AssistantError(
      "Unexpected error processing chat request: Missing response.",
      ErrorType.EXTERNAL_API_ERROR,
    );
  }

  if (!result.response) {
    throw new AssistantError("No response generated by the model", ErrorType.EXTERNAL_API_ERROR);
  }

  const assistantMessage = formatAssistantMessage({
    content: result.response.response,
    citations: result.response.citations || [],
    tool_calls: result.response.tool_calls || [],
    data: result.response.data || null,
    usage: result.response.usage || result.response.usageMetadata,
    log_id: env.AI.aiGatewayLogId,
    model: result.selectedModel || (result.selectedModels ? result.selectedModels.join(", ") : ""),
    selected_models: result.selectedModels,
    finish_reason: result.response.tool_calls?.length ? "tool_calls" : "stop",
    refusal: result.response?.refusal ?? null,
    annotations: result.response?.annotations ?? null,
  });

  const assistantParts = buildMessageParts({
    role: "assistant",
    content: assistantMessage.content,
    tool_calls: assistantMessage.tool_calls,
    data: assistantMessage.data,
    timestamp: Date.now(),
  });

  return {
    id: env.AI.aiGatewayLogId || completionIdWithFallback,
    log_id: env.AI.aiGatewayLogId,
    object: "chat.completion",
    created: Date.now(),
    model: assistantMessage.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: assistantMessage.content,
          parts: assistantParts,
          data: assistantMessage.data,
          tool_calls: assistantMessage.tool_calls,
          citations: assistantMessage.citations,
          status: result.response.status || undefined,
        },
        finish_reason: assistantMessage.finish_reason,
      },
      ...toProviderResponseMessages([
        ...(connectorReplay ? [connectorReplay.toolResult] : []),
        ...("toolResponses" in result && result.toolResponses ? result.toolResponses : []),
      ]).map((toolResponse, index) => {
        const messagePartSource = toProviderResponseMessagePartSource(toolResponse);

        return {
          index: index + 1,
          message: {
            id: toolResponse.id,
            log_id: env.AI.aiGatewayLogId,
            role: toolResponse.role,
            name: toolResponse.name,
            content: Array.isArray(toolResponse.content)
              ? toolResponse.content.map((c) => c.text || "").join("\n")
              : typeof toolResponse.content === "string"
                ? toolResponse.content
                : JSON.stringify(toolResponse.content),
            parts: toolResponse.parts || buildMessageParts(messagePartSource),
            citations: toolResponse.citations || null,
            data: toolResponse.data || null,
            status: toolResponse.status || "unknown",
            timestamp: toolResponse.timestamp,
            tool_call_id: toolResponse.tool_call_id,
            tool_call_arguments: toolResponse.tool_call_arguments,
          },
          finish_reason: "tool_result",
        };
      }),
    ],
    usage: assistantMessage.usage,
    post_processing: buildChatPostProcessing({
      guardrails: assistantMessage.guardrails,
      response: result.response,
      compactionMessage: "compactionMessage" in result ? result.compactionMessage : undefined,
    }),
  };
};
