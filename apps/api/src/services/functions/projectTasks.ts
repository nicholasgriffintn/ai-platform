import {
  projectTaskStatusLabels,
  type Goal,
  type ProjectTask,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";

import {
  createProjectTask,
  getProjectTask,
  listProjectTasks,
  updateProjectTask,
} from "~/services/project-tasks";
import type { IRequest } from "~/types";

import type { ApiToolDefinition } from "../../types/functions";
import {
  create_task as create_taskDescriptor,
  list_tasks as list_tasksDescriptor,
  get_task as get_taskDescriptor,
  update_task as update_taskDescriptor,
  MODEL_SETTABLE_STATUSES,
} from "./definitions/projectTasks";
import { resolveRequestProjectId } from "./request-context";

const MAX_LISTED_TASKS = 25;

function formatTask(task: ProjectTask): string {
  const stage = task.stageId ? ` [${task.stageId}]` : "";
  const criteria = task.acceptanceCriteria.length
    ? ` (${task.acceptanceCriteria.length} criteria)`
    : "";
  const blocked = task.blockedDetail ? ` — ${task.blockedDetail}` : "";

  return `${task.id}${stage}: ${task.objective}${criteria} (${projectTaskStatusLabels[task.status]})${blocked}`;
}

function formatTaskDetail(task: ProjectTask, goal: Goal | null): string {
  const lines = [formatTask(task)];

  if (task.expectedOutput) {
    lines.push(`Expected output: ${task.expectedOutput}`);
  }

  if (task.acceptanceCriteria.length > 0) {
    lines.push(
      "Done when:",
      ...task.acceptanceCriteria.map((criterion) => `- ${criterion.id}: ${criterion.text}`),
    );
  }

  if (goal) {
    lines.push(`Goal: ${goal.status}`);

    if (goal.stopped_reason) {
      lines.push(`Stopped reason: ${goal.stopped_reason}`);
    }

    if (goal.evidence?.length) {
      lines.push(
        "Evidence:",
        ...goal.evidence.map(
          (entry) =>
            `- ${entry.status}: ${entry.claim} — ${entry.route} (${entry.evidence_surface})`,
        ),
      );
    }
  }

  return lines.join("\n");
}

function requireProjectId(request: IRequest): string {
  const projectId = resolveRequestProjectId(request);

  if (!projectId) {
    throw new Error(
      "Project task tools are only available in a project conversation. Ask the person to open the project first.",
    );
  }

  return projectId;
}

export const create_task: ApiToolDefinition = {
  ...create_taskDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const projectId = requireProjectId(request);

    if (!request.context) {
      throw new Error("Signed-in project context is required for project task tools");
    }

    const { task } = await createProjectTask(
      request.context,
      projectId,
      {
        objective: String(args.objective ?? "").trim(),
        acceptanceCriteria: Array.isArray(args.acceptanceCriteria)
          ? args.acceptanceCriteria
              .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
              .map((text) => ({ text: text.trim() }))
          : undefined,
        expectedOutput: typeof args.expectedOutput === "string" ? args.expectedOutput.trim() : null,
        stageId: typeof args.stageId === "string" ? args.stageId : null,
      },
      { source: "model" },
    );

    return {
      status: "success",
      name: "create_task",
      content: `Added to the work queue: ${formatTask(task)}`,
      data: { task },
    };
  },
};

export const list_tasks: ApiToolDefinition = {
  ...list_tasksDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const projectId = requireProjectId(request);

    if (!request.context) {
      throw new Error("Signed-in project context is required for project task tools");
    }

    const status =
      typeof args.status === "string" && args.status in projectTaskStatusLabels
        ? (args.status as ProjectTaskStatus)
        : undefined;
    const { tasks } = await listProjectTasks(request.context, projectId, {
      status,
    });
    const visible = tasks.slice(0, MAX_LISTED_TASKS);

    return {
      status: "success",
      name: "list_tasks",
      content: visible.length
        ? `Work queue:\n${visible.map(formatTask).join("\n")}`
        : "This work queue has no tasks matching that filter.",
      data: { renderer: "project_task_list", tasks: visible, total: tasks.length },
    };
  },
};

export const get_task: ApiToolDefinition = {
  ...get_taskDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const projectId = requireProjectId(request);

    if (!request.context) {
      throw new Error("Signed-in project context is required for project task tools");
    }

    const result = await getProjectTask(request.context, projectId, String(args.taskId ?? ""));

    return {
      status: "success",
      name: "get_task",
      content: formatTaskDetail(result.task, result.goal),
      data: result,
    };
  },
};

export const update_task: ApiToolDefinition = {
  ...update_taskDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const projectId = requireProjectId(request);

    if (!request.context) {
      throw new Error("Signed-in project context is required for project task tools");
    }

    const status =
      typeof args.status === "string" &&
      MODEL_SETTABLE_STATUSES.includes(args.status as ProjectTaskStatus)
        ? (args.status as ProjectTaskStatus)
        : undefined;
    const { task } = await updateProjectTask(
      request.context,
      projectId,
      String(args.taskId ?? ""),
      {
        ...(typeof args.objective === "string" ? { objective: args.objective.trim() } : {}),
        ...(Array.isArray(args.acceptanceCriteria)
          ? {
              acceptanceCriteria: args.acceptanceCriteria
                .filter(
                  (entry): entry is string => typeof entry === "string" && entry.trim() !== "",
                )
                .map((text) => ({ text: text.trim() })),
            }
          : {}),
        ...(status ? { status } : {}),
      },
      { actor: "model" },
    );

    return {
      status: "success",
      name: "update_task",
      content: `Updated: ${formatTask(task)}`,
      data: { task },
    };
  },
};
