import type { ExecutionContext } from "@cloudflare/workers-types";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { startResponse } from "~/modules/responses/application/start";
import type { ResponseCommand } from "~/modules/responses/domain/command";
import { resumeStoredTeammateInteraction } from "~/modules/teammates/application/interaction-resume";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";
import type { AnonymousUser, IUser } from "~/types";

export interface PrepareConversationCompletionInput {
  context: ServiceContext;
  request: ResponseCommand;
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
      await getRequestUserSettings(context);
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
    startResponse({ ...completionContext, command: request })
  );
}
