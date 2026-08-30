import {
  projectTaskBlockedReasonLabels,
  type ProjectTask,
  type ProjectTaskAttentionItem,
  type ProjectTaskAttentionKind,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireWorkAccess } from "~/services/workspaces/access";

const DEFAULT_ATTENTION_LIMIT = 50;

function attentionKindFor(task: ProjectTask, userId: number): ProjectTaskAttentionKind | null {
  if (task.status === "blocked") {
    return task.blockedReason === "awaiting_approval" ? "approval" : "blocked";
  }

  if (task.status === "review") {
    return "review";
  }

  if (task.status === "backlog" && task.assigneeUserId === userId) {
    return "assigned";
  }

  return null;
}

function attentionDetail(task: ProjectTask): string | null {
  if (task.status === "blocked" && task.blockedReason) {
    return task.blockedDetail ?? projectTaskBlockedReasonLabels[task.blockedReason];
  }

  if (task.status === "review") {
    return "The assistant believes this is done and is waiting for you to accept it";
  }

  return task.blockedDetail;
}

export async function listProjectTaskAttention(
  context: ServiceContext,
  options: { limit?: number } = {},
) {
  const user = requireWorkAccess(context);
  const workspaces = await context.repositories.workspaces.listWorkspaces(user.id);
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const limit = Math.min(options.limit ?? DEFAULT_ATTENTION_LIMIT, 100);
  const tasks = await context.repositories.projectTasks.listAttentionTasks(
    workspaceIds,
    user.id,
    limit,
  );

  if (tasks.length === 0) {
    return { items: [], total: 0 };
  }

  const projectIds = [...new Set(tasks.map((task) => task.projectId))];
  const projects = await Promise.all(
    projectIds.map((projectId) => context.repositories.workspaces.getProject(projectId)),
  );
  const projectNameById = new Map(
    projects
      .filter((project): project is NonNullable<typeof project> => Boolean(project))
      .map((project) => [project.id, project.name]),
  );

  const items = tasks.reduce<ProjectTaskAttentionItem[]>((accumulator, task) => {
    const kind = attentionKindFor(task, user.id);
    const projectName = projectNameById.get(task.projectId);

    if (!kind || !projectName) {
      return accumulator;
    }

    accumulator.push({
      kind,
      taskId: task.id,
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      projectName,
      objective: task.objective,
      detail: attentionDetail(task),
      conversationId: task.conversationId,
      since: task.updatedAt ?? task.createdAt,
    });

    return accumulator;
  }, []);

  return { items, total: items.length };
}
