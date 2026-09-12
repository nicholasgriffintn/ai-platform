import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

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
