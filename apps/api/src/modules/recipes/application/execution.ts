import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type {
  ConversationChannelRequestOptions,
  RecipeInvocationResponse,
  TeammateInvocation,
} from "@ngriffin_uk/polychat-schemas";
import { createRecipeChatRequestOptions } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { getDefaultChatModel } from "~/modules/models/application/resolve";
import { recoverAcceptedChatCompletionResponse } from "~/modules/responses/application/runs/completion-recovery";
import { startResponse } from "~/modules/responses/application/start";
import type { ResponseCommand } from "~/modules/responses/domain/command";
import { enqueueTeammateRun } from "~/modules/teammates/application/run-admission";
import type { CreateChatCompletionsResponse, IEnv, IUser, Message } from "~/types";
import type { ChatRequestOptions } from "~/types/chat";

import { assertRecipeInstallationWithinBudget } from "./installation-budget";

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

  await params.context.repositories
    .get(ConversationRepository)
    .updateConversation(params.conversationId, {
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
  if (params.invocation.installationId) {
    await assertRecipeInstallationWithinBudget({
      context: params.context,
      userId: params.user.id,
      installationId: params.invocation.installationId,
    });
  }

  const conversationId = params.conversationId ?? `recipe_${generateId()}`;
  const shouldTitleGeneratedConversation = params.titleConversation ?? !params.conversationId;
  const request: ResponseCommand = {
    conversationId,
    ...(params.commandId ? { commandId: params.commandId } : {}),
    messages: [
      ...(params.priorMessages ?? []),
      {
        role: "user",
        content: params.invocation.conversationStarter,
      },
    ],
    stream: false,
    store: true,
    settings: {
      mode: "agent",
      enabled_tools: params.invocation.enabledTools,
      tool_choice: "auto",
      reasoning: { effort: "none" },
      metadata: params.projectId ? { project_id: params.projectId } : undefined,
      options: buildRecipeExecutionOptions(params),
    },
  };
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
        authority: {
          trigger: "schedule",
          ...(params.invocation.readOnly ? { autonomyCeiling: "observer" as const } : {}),
          ...(params.invocation.dryRun ? { dryRun: true } : {}),
        },
      })
    : await startResponse({
        env: params.env,
        context: params.context,
        user: params.user,
        command: { ...request, conversationType: "task" },
        authority: {
          trigger: "schedule",
          ...(params.invocation.dryRun ? { dryRun: true } : {}),
        },
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
      await params.context.repositories
        .get(ConversationRepository)
        .updateConversation(conversationId, {
          title: buildRecipeConversationTitle(params.invocation),
        });
    } catch (error) {
      logger.warn("Failed to title generated recipe conversation", {
        conversationId,
        recipeId: params.invocation.recipeId,
        error: getErrorMessage(error),
      });
    }
  }

  return { conversationId, response: completedResponse };
}
