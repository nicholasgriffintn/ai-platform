import type { ExecutionContext } from "@cloudflare/workers-types";
import type { ChatCompletionRequestBody } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { handleCreateChatCompletions } from "~/modules/completions/application/createChatCompletions";
import { resumeStoredTeammateInteraction } from "~/modules/teammates/application/interaction-resume";
import type { AnonymousUser, IUser } from "~/types";

export interface PrepareConversationCompletionInput {
  context: ServiceContext;
  request: ChatCompletionRequestBody;
  user?: IUser;
  anonymousUser?: AnonymousUser;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
  location: {
    longitude?: number;
    latitude?: number;
  };
}

export async function prepareConversationCompletion({
  context,
  request,
  user: userContext,
  anonymousUser,
  executionCtx,
  signal,
  location,
}: PrepareConversationCompletionInput) {
  const user = { ...location, ...userContext };

  if (user?.id) {
    try {
      await context.getUserSettings();
    } catch (error) {
      context
        .getLogger({ prefix: "conversations/completion-preparation" })
        .warn("Failed to preload user settings", {
          requestId: context.requestId,
          error,
        });
    }
  }

  const completionContext = {
    env: context.env,
    context,
    user,
    anonymousUser,
    executionCtx,
    signal,
  };

  return (
    (await resumeStoredTeammateInteraction({ ...completionContext, body: request })) ??
    handleCreateChatCompletions({ ...completionContext, request })
  );
}
