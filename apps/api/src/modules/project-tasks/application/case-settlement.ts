import { isTerminalProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";

export async function settleCasesResolvedBy(
  context: ServiceContext,
  taskId: string,
): Promise<void> {
  const repository = context.repositories.get(ProjectTaskRepository);
  const incoming = (await repository.listLinks(taskId)).filter(
    (link) => link.kind === "resolved_by" && link.toTaskId === taskId,
  );

  for (const link of incoming) {
    const caseTask = await repository.getTaskById(link.fromTaskId);

    if (!caseTask || caseTask.kind !== "case" || isTerminalProjectTaskStatus(caseTask.status)) {
      continue;
    }

    const resolvers = (await repository.listLinks(caseTask.id)).filter(
      (candidate) => candidate.kind === "resolved_by" && candidate.fromTaskId === caseTask.id,
    );
    const resolverTasks = await repository.listTasksByIds(
      resolvers.map((candidate) => candidate.toTaskId),
    );

    if (resolverTasks.some((resolver) => resolver.status !== "done")) {
      continue;
    }

    const resolvedAt = new Date().toISOString();
    const keys = resolverTasks.map((resolver) => resolver.key ?? resolver.id).join(", ");

    await repository.updateTask(caseTask.id, {
      status: "done",
      blockedReason: null,
      blockedDetail: null,
      completedAt: resolvedAt,
      details: {
        ...caseTask.details,
        case: caseTask.details.case
          ? {
              ...caseTask.details.case,
              resolution: caseTask.details.case.resolution ?? `Resolved by ${keys}.`,
              resolvedAt,
            }
          : undefined,
      },
    });
  }
}
