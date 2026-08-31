import type {
  ConversationChannelRequestOptions,
  RecipeInvocationResponse,
} from "@ngriffin_uk/polychat-schemas";
import { createRecipeChatRequestOptions } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { getDefaultChatModel } from "~/lib/providers/models";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
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
}): Promise<{
  conversationId: string;
  response: CreateChatCompletionsResponse;
}> {
  const conversationId = params.conversationId ?? `recipe_${generateId()}`;
  const shouldTitleGeneratedConversation = params.titleConversation ?? !params.conversationId;
  const response = await handleCreateChatCompletions({
    env: params.env,
    context: params.context,
    user: params.user,
    request: {
      completion_id: conversationId,
      conversation_type: "task",
      messages: [
        ...(params.priorMessages ?? []),
        {
          role: "user",
          content: params.invocation.conversationStarter,
        },
      ],
      model_router_mode: "auto",
      mode: "agent",
      stream: false,
      store: true,
      enabled_tools: params.invocation.enabledTools,
      approved_tools: params.invocation.enabledTools,
      tool_choice: "auto",
      temperature: 0.4,
      metadata: params.projectId ? { project_id: params.projectId } : undefined,
      options: buildRecipeExecutionOptions(params),
    },
  });

  if (response instanceof Response) {
    throw new AssistantError(
      "Recipe execution unexpectedly returned a streaming response",
      ErrorType.INTERNAL_ERROR,
    );
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

  return { conversationId, response };
}
