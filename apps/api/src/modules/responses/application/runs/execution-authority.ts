import { authorise } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";

export async function requireActiveExecutionRun(context: ServiceContext): Promise<void> {
  if (!context.executionRunId || context.executionRunAttempt === undefined) {
    return;
  }

  const run = await context.repositories
    .get(ConversationRunRepository)
    .getById(context.executionRunId);

  const isAuthorised = authorise("run.effect", {
    exists: Boolean(run),
    attempt: run?.attempt ?? 0,
    expectedAttempt: context.executionRunAttempt,
    status: run?.status ?? "",
    cancelled: Boolean(run?.cancellationRequestedAt),
  }).allowed;

  if (!isAuthorised) {
    throw new AssistantError(
      "The run was cancelled before the connector action started",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }
}
