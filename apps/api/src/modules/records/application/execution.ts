import type { ServiceContext } from "~/infrastructure/context/serviceContext";

export async function nativeRecordExecutionOrigin(
  context: ServiceContext,
  taskId?: string,
): Promise<string | undefined> {
  if (taskId) {
    return taskId;
  }

  if (context.projectTaskExecution) {
    return context.projectTaskExecution.taskId;
  }

  if (!context.executionRunId) {
    return undefined;
  }

  const run = await context.repositories.conversationRuns.getById(context.executionRunId);

  return run?.projectTaskId ?? undefined;
}
