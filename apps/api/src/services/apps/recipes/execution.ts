import type {
  ConversationChannelRequestOptions,
  RecipeInvocationResponse,
  TeammateInvocation,
} from "@ngriffin_uk/polychat-schemas";
import {
  createChatCompletionsJsonSchema,
  createRecipeChatRequestOptions,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { getDefaultChatModel } from "~/lib/providers/models";
import { recoverAcceptedChatCompletionResponse } from "~/services/chat-runs/completion-recovery";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { enqueueTeammateRun } from "~/services/teammates/run-admission";
import type { CreateChatCompletionsResponse, IEnv, IUser, Message } from "~/types";
import type { ChatRequestOptions } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/recipes/execution" });

function buildRecipeExecutionOptions(params: {
  invocation: RecipeInvocationResponse;
  channel?: ConversationChannelRequestOptions;
}): ChatRequestOptions {
  return {
    ...(params.channel
      ? {
          source: params.channel.id,
          channel: params.channel,
        }
      : {}),
    ...(params.invocation.enabledTools.length > 0
      ? {
          agent: {
            minToolCalls: 1,
          },
        }
      : {}),
    recipe: createRecipeChatRequestOptions(params.invocation),
  };
}

function buildRecipeConversationTitle(invocation: RecipeInvocationResponse): string {
  return `Recipe: ${invocation.recipeTitle || invocation.recipeId}`.trim();
}

function getRecipeExecutionFailureContent(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";

  return `Recipe execution failed before I could complete the run: ${message}`;
}

export async function recordRecipeInvocationFailure(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  invocation: RecipeInvocationResponse;
  conversationId: string;
  projectId?: string;
  error: unknown;
}): Promise<string> {
  const defaultModel = await getDefaultChatModel(params.env, params.user);
  const conversationManager = ConversationManager.getInstance({
    database: params.context.database,
    repositories: params.context.repositories,
    user: params.user,
    model: defaultModel.model,
    provider: defaultModel.provider,
    platform: "api",
    store: true,
    env: params.env,
    requestCache: params.context.requestCache,
  });
  const existingMessages = await conversationManager
    .get(params.conversationId)
    .catch((): Message[] => []);
  const messagesToAdd: Message[] = [];

  if (existingMessages.length === 0) {
    messagesToAdd.push({
      role: "user",
      content: params.invocation.conversationStarter,
    });
  }

  const content = getRecipeExecutionFailureContent(params.error);
  const hasFailureMessage = existingMessages.some(
    (message) => message.role === "assistant" && message.content === content,
  );

  if (!hasFailureMessage) {
    messagesToAdd.push({
      role: "assistant",
      content,
    });
  }

  if (messagesToAdd.length > 0) {
    await conversationManager.addBatch(params.conversationId, messagesToAdd, {
      metadata: params.projectId ? { project_id: params.projectId } : undefined,
      type: "task",
    });
  }

  await params.context.repositories.conversations.updateConversation(params.conversationId, {
    title: buildRecipeConversationTitle(params.invocation),
  });

  return content;
}

export async function executeRecipeInvocationChat(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  invocation: RecipeInvocationResponse;
  conversationId?: string;
  projectId?: string;
  titleConversation?: boolean;
  priorMessages?: Message[];
  channel?: ConversationChannelRequestOptions;
  commandId?: string;
  teammate?: { id: string; invocation: TeammateInvocation };
}): Promise<{
  conversationId: string;
  response: CreateChatCompletionsResponse;
}> {
  const conversationId = params.conversationId ?? `recipe_${generateId()}`;
  const shouldTitleGeneratedConversation = params.titleConversation ?? !params.conversationId;
  const request = createChatCompletionsJsonSchema.parse({
    completion_id: conversationId,
    ...(params.commandId ? { command_id: params.commandId } : {}),
    messages: [
      ...(params.priorMessages ?? []),
      {
        role: "user",
        content: params.invocation.conversationStarter,
      },
    ],
    mode: "agent",
    trigger: "schedule",
    stream: false,
    store: true,
    enabled_tools: params.invocation.enabledTools,
    tool_choice: "auto",
    reasoning: { effort: "none" },
    metadata: params.projectId ? { project_id: params.projectId } : undefined,
    options: buildRecipeExecutionOptions(params),
  });
  const response = params.teammate
    ? await enqueueTeammateRun({
        env: params.env,
        context: params.context,
        body: request,
        teammateId: params.teammate.id,
        invocation: params.teammate.invocation,
        user: params.user,
        anonymousUser: undefined,
        conversationType: "task",
        trigger: "schedule",
      })
    : await handleCreateChatCompletions({
        env: params.env,
        context: params.context,
        user: params.user,
        request: { ...request, conversation_type: "task" },
      });

  let recoveredResponse: CreateChatCompletionsResponse | null = null;

  if (response instanceof Response && params.commandId) {
    recoveredResponse =
      (
        await recoverAcceptedChatCompletionResponse(params.context, {
          userId: params.user.id,
          commandId: params.commandId,
          conversationId,
        })
      )?.response ?? null;
  }

  let completedResponse: CreateChatCompletionsResponse;

  if (response instanceof Response) {
    if (!recoveredResponse) {
      throw new AssistantError(
        "Recipe execution unexpectedly returned a streaming response",
        ErrorType.INTERNAL_ERROR,
      );
    }

    completedResponse = recoveredResponse;
  } else {
    completedResponse = response;
  }

  if (shouldTitleGeneratedConversation) {
    try {
      await params.context.repositories.conversations.updateConversation(conversationId, {
        title: buildRecipeConversationTitle(params.invocation),
      });
    } catch (error) {
      logger.warn("Failed to title generated recipe conversation", {
        conversationId,
        recipeId: params.invocation.recipeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { conversationId, response: completedResponse };
}
