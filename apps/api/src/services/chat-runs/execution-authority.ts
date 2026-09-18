import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/lib/context/serviceContext";

export async function requireActiveExecutionRun(context: ServiceContext): Promise<void> {
  if (!context.executionRunId || context.executionRunAttempt === undefined) {
    return;
  }

  const run = await context.repositories.conversationRuns.getById(context.executionRunId);

  if (
    !run ||
    run.attempt !== context.executionRunAttempt ||
    run.status !== "running" ||
    run.cancellationRequestedAt
  ) {
    throw new AssistantError(
      "The run was cancelled before the connector action started",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }
}
