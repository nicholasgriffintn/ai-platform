import {
  isTerminalProjectTaskStatus,
  setupPlanStateSchema,
  toListPage,
  usagePeriodFromDate,
  type WorkInboxItem,
  type WorkInboxResponse,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { requireWorkAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

function taskLink(workspaceId: string, projectId: string, taskId: string): string {
  return `/work/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;
}

export async function getWorkInbox(context: ServiceContext): Promise<WorkInboxResponse> {
  const user = requireWorkAccess(context);
  const workspaces = await context.repositories.get(WorkspaceRepository).listWorkspaces(user.id);
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const managed = new Set(
    workspaces
      .filter((workspace) => workspace.role === "owner" || workspace.role === "admin")
      .map((workspace) => workspace.id),
  );
  const [employments, openTasks] = await Promise.all([
    context.repositories.get(WorkspaceTeammateRepository).listForWorkspaces(workspaceIds),
    context.repositories.get(ProjectTaskRepository).listWorkspaceTasks(workspaceIds, {}),
  ]);
  const teammates = await context.repositories
    .get(TeammateRepository)
    .getTeammatesByIds([...new Set(employments.map((employment) => employment.teammateId))]);
  const names = new Map(teammates.map((teammate) => [teammate.id, teammate.name]));
  const period = usagePeriodFromDate();
  const items: WorkInboxItem[] = [];

  for (const employment of employments.filter((record) => managed.has(record.workspaceId))) {
    const name = names.get(employment.teammateId) ?? "A teammate";
    const base = {
      workspaceId: employment.workspaceId,
      projectId: null,
      taskId: null,
      teammateId: employment.teammateId,
      deepLink: `/work/${encodeURIComponent(employment.workspaceId)}/team/${encodeURIComponent(employment.teammateId)}`,
    };

    if (employment.status === "proposed" && employment.proposal) {
      items.push({
        ...base,
        id: `hire:${employment.workspaceId}:${employment.teammateId}`,
        kind: "hire",
        title: `Hire ${name} as ${employment.title}`,
        detail: employment.proposal.reason,
        since: employment.proposal.proposedAt,
      });
    } else if (employment.status === "paused" && employment.pausedReason === "budget") {
      items.push({
        ...base,
        id: `paused:${employment.workspaceId}:${employment.teammateId}`,
        kind: "paused",
        title: `${name} is paused: monthly budget used`,
        detail: "Raise its cap on the Team page to resume its work.",
        since: employment.createdAt,
      });
    } else if (employment.status === "active" && employment.budgetWarnedPeriod === period) {
      items.push({
        ...base,
        id: `budget:${employment.workspaceId}:${employment.teammateId}:${period}`,
        kind: "budget",
        title: `${name} has used 80% of its monthly budget`,
        detail: "It pauses at 100%. Raise the cap on the Team page if it needs more.",
        since: employment.createdAt,
      });
    }
  }

  for (const task of openTasks) {
    const standup = task.details.standup;

    if (
      task.kind === "standup" &&
      standup &&
      !standup.summary &&
      standup.participants.some(
        (participant) =>
          participant.actor.type === "person" && participant.actor.userId === user.id,
      ) &&
      !standup.answers.some(
        (answer) => answer.actor.type === "person" && answer.actor.userId === user.id,
      )
    ) {
      items.push({
        id: `standup:${task.id}`,
        kind: "standup",
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        teammateId: null,
        title: task.objective,
        detail: `${standup.questions.length} questions · closes ${new Date(standup.closesAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
        since: task.createdAt,
        deepLink: taskLink(task.workspaceId, task.projectId, task.id),
      });
    }

    const escalation = task.details.escalation;

    if (
      escalation &&
      escalation.to.type === "person" &&
      escalation.to.userId === user.id &&
      !isTerminalProjectTaskStatus(task.status)
    ) {
      items.push({
        id: `escalation:${task.id}:${escalation.at}`,
        kind: "escalation",
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        teammateId: escalation.by.type === "teammate" ? escalation.by.id : null,
        title: `${task.key ?? "Task"} escalated: ${task.objective}`,
        detail: escalation.reason,
        since: escalation.at,
        deepLink: taskLink(task.workspaceId, task.projectId, task.id),
      });
    }
  }

  for (const workspace of workspaces.filter((candidate) => managed.has(candidate.id))) {
    const detail = await context.repositories.get(WorkspaceRepository).getWorkspace(workspace.id);
    const parsed = setupPlanStateSchema.safeParse(
      detail?.setup_plan ? safeParseJson(detail.setup_plan) : null,
    );

    if (parsed.success && !parsed.data.appliedAt) {
      items.push({
        id: `setup:${workspace.id}:${parsed.data.revision}`,
        kind: "setup",
        workspaceId: workspace.id,
        projectId: detail?.setup_project_id ?? null,
        taskId: detail?.setup_task_id ?? null,
        teammateId: detail?.lead_teammate_id ?? null,
        title: `Approve the setup plan for ${workspace.name}`,
        detail: `Revision ${parsed.data.revision}: ${parsed.data.plan.projects.length} projects, ${parsed.data.plan.teammates.length} teammates`,
        since: workspace.updated_at ?? workspace.created_at,
        deepLink: `/work/${encodeURIComponent(workspace.id)}/setup`,
      });
    }
  }

  items.sort((left, right) => right.since.localeCompare(left.since));

  return toListPage(items, items.length || 1, (item) => item.id);
}
