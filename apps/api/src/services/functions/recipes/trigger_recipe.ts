import { invokeAssistantRecipe, resolveInstalledAssistantRecipe } from "~/services/apps/recipes";
import { getRecipeConversationContext } from "~/services/apps/recipes/conversationContext";
import { executeRecipeInvocationChat } from "~/services/apps/recipes/execution";
import {
  getRecipeExecutionChannelContext,
  getTriggerRecipeChannel,
} from "~/services/apps/recipes/toolContext";
import { extractChatCompletionNotification } from "~/utils/messages";

import type { ApiToolDefinition } from "../../../types/functions";
import { trigger_recipe as trigger_recipeDescriptor } from "../definitions/recipes/trigger_recipe";

export const trigger_recipe: ApiToolDefinition = {
  ...trigger_recipeDescriptor,
  execute: async (args, context) => {
    const request = context.request;

    if (!request.context || !request.user?.id) {
      throw new Error("Signed-in user context is required for recipe tools");
    }

    const explicitRecipeId = typeof args.recipeId === "string" ? args.recipeId.trim() : "";
    const query =
      typeof args.query === "string" && args.query.trim()
        ? args.query.trim()
        : typeof args.input === "string"
          ? args.input.trim()
          : "";
    const triggerInput =
      typeof args.input === "string" && args.input.trim() ? args.input.trim() : query;

    if (!explicitRecipeId && !query) {
      return {
        status: "error",
        name: "trigger_recipe",
        content: "Provide a recipe id or describe which installed recipe to trigger.",
        data: { candidates: [] },
      };
    }

    let resolvedRecipeId = explicitRecipeId;

    if (!resolvedRecipeId) {
      const match = await resolveInstalledAssistantRecipe({
        context: request.context,
        userId: request.user.id,
        query,
      });

      if (match.status === "matched" && match.recipe) {
        resolvedRecipeId = match.recipe.id;
      } else {
        return {
          status: "error",
          name: "trigger_recipe",
          content:
            match.status === "ambiguous"
              ? "That recipe request matches more than one installed recipe. Ask which recipe to run."
              : "I could not find a matching installed recipe.",
          data: { query, candidates: match.candidates },
        };
      }
    }

    const recipeChannel = getTriggerRecipeChannel(request.request?.options);
    const channel = getRecipeExecutionChannelContext(request.request?.options);
    const invocation = await invokeAssistantRecipe(resolvedRecipeId, {
      context: request.context,
      userId: request.user.id,
      channel: recipeChannel,
      input: triggerInput || undefined,
      requireInstalled: true,
    });

    if (!invocation) {
      return {
        status: "error",
        name: "trigger_recipe",
        content: "Recipe not found",
        data: { recipeId: resolvedRecipeId },
      };
    }

    if (invocation.status === "ready") {
      const priorMessages = await getRecipeConversationContext({
        conversationManager: context.conversationManager,
        conversationId: context.completionId,
      });
      const execution = await executeRecipeInvocationChat({
        env: request.env,
        context: request.context,
        user: request.user,
        invocation,
        priorMessages,
        ...(channel ? { channel } : {}),
      });
      const notification = extractChatCompletionNotification(execution.response, {
        streamingMessage: "Recipe execution cannot return a streaming response",
      });

      return {
        status: "success",
        name: "trigger_recipe",
        content: notification.body,
        data: {
          ...invocation,
          executionConversationId: execution.conversationId,
          notification,
          mediaUrls: notification.mediaUrls,
        },
      };
    }

    return {
      status:
        invocation.status === "blocked" || invocation.status === "not_installed"
          ? "error"
          : "success",
      name: "trigger_recipe",
      content: invocation.conversationStarter,
      data: invocation,
    };
  },
};
