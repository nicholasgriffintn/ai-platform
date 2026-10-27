import type { WorkInboxItem } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";

import { breakdownHasTeammateApprover } from "../domain/breakdown";
import { projectTaskLink } from "../domain/links";
import { isAwaitingStandupAnswer } from "../domain/standups";
import { taskReference } from "../domain/work-actors";

export async function listProjectTaskInboxItems(
  context: ServiceContext,
  params: { userId: number; workspaceIds: readonly string[] },
): Promise<WorkInboxItem[]> {
  const [tasks, team] = await Promise.all([
    context.repositories.get(ProjectTaskRepository).listOpenTasksForInbox(params.workspaceIds),
    context.repositories.get(WorkspaceTeammateRepository).listForWorkspaces(params.workspaceIds),
  ]);
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
        conversationId: null,
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
        conversationId: null,
        since: escalation.at,
        deepLink,
      });
    }

    const breakdown = task.details.breakdown;

    if (
      breakdown &&
      !breakdown.acceptedAt &&
      !breakdownHasTeammateApprover(
        task,
        team.filter((member) => member.workspaceId === task.workspaceId),
      )
    ) {
      items.push({
        id: `breakdown:${task.id}:${breakdown.revision}`,
        kind: "breakdown",
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        teammateId: breakdown.proposedBy.type === "teammate" ? breakdown.proposedBy.id : null,
        title: `Accept the breakdown of ${taskReference(task)}: ${task.objective}`,
        detail: `${breakdown.items.length} sub-tasks proposed`,
        dueAt: null,
        conversationId: null,
        since: breakdown.proposedAt,
        deepLink,
      });
    }

    return items;
  });
}
