import type { WorkInboxItem } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";

import { projectTaskLink } from "../domain/links";
import { isAwaitingStandupAnswer } from "../domain/standups";
import { taskReference } from "../domain/work-actors";

export async function listProjectTaskInboxItems(
  context: ServiceContext,
  params: { userId: number; workspaceIds: readonly string[] },
): Promise<WorkInboxItem[]> {
  const tasks = await context.repositories
    .get(ProjectTaskRepository)
    .listOpenStandupsAndEscalations(params.workspaceIds);
  const me = { type: "person" as const, userId: params.userId };

  return tasks.flatMap((task): WorkInboxItem[] => {
    const deepLink = projectTaskLink(task.workspaceId, task.projectId, task.id);
    const standup = task.details.standup;
    const escalation = task.details.escalation;
    const items: WorkInboxItem[] = [];

    if (task.kind === "standup" && standup && isAwaitingStandupAnswer(standup, me)) {
      items.push({
        id: `standup:${task.id}`,
        kind: "standup",
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        teammateId: null,
        title: task.objective,
        detail: `${standup.questions.length} questions`,
        dueAt: standup.closesAt,
        since: task.createdAt,
        deepLink,
      });
    }

    if (escalation?.to.type === "person" && escalation.to.userId === params.userId) {
      items.push({
        id: `escalation:${task.id}:${escalation.at}`,
        kind: "escalation",
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        teammateId: escalation.by.type === "teammate" ? escalation.by.id : null,
        title: `${taskReference(task)} escalated: ${task.objective}`,
        detail: escalation.reason,
        dueAt: null,
        since: escalation.at,
        deepLink,
      });
    }

    return items;
  });
}
