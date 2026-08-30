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
import { jsonSchemaToZod } from "../../utils/jsonSchema";
import { resolveRequestProjectId } from "./request-context";

const MAX_LISTED_TASKS = 25;

const MODEL_SETTABLE_STATUSES: ProjectTaskStatus[] = ["backlog", "review", "cancelled"];

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
  name: "create_task",
  description:
    "Add work to this project's task system so it is captured outside this conversation. Use it when the person describes work to do later, or when you split an objective into separate pieces. Tasks start in the backlog and nobody runs them until a person says so.",
  type: "normal",
  costPerCall: 0,
  permissions: ["write"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      objective: {
        type: "string",
        description: "What the task should achieve, in one or two sentences.",
      },
      acceptanceCriteria: {
        type: "array",
        description:
          "Separate checkable statements the task must satisfy. Prefer these over prose: the goal gate checks the work against them.",
        items: { type: "string" },
      },
      expectedOutput: {
        type: "string",
        description: "A concrete description of the result the task should leave behind.",
      },
      stageId: {
        type: "string",
        description: "Optional flow stage id to start the task in.",
      },
    },
    required: ["objective"],
    additionalProperties: false,
  }),
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
  name: "list_tasks",
  description:
    "List this project's work queue so you can see what is already captured, running, or waiting on a person. Check this before creating a task that may already exist.",
  type: "normal",
  costPerCall: 0,
  permissions: ["read"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      status: {
        type: "string",
        description:
          "Optional status filter: backlog, queued, running, blocked, review, done, or cancelled.",
      },
    },
    additionalProperties: false,
  }),
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
      data: { tasks: visible, total: tasks.length },
    };
  },
};

export const get_task: ApiToolDefinition = {
  name: "get_task",
  description:
    "Get one task from this project, including its acceptance criteria, execution state, and goal evidence. Use it before changing a task or when the person asks about one exact task.",
  type: "normal",
  costPerCall: 0,
  permissions: ["read"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: { type: "string", description: "The exact id of the task to retrieve." },
    },
    required: ["taskId"],
    additionalProperties: false,
  }),
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
  name: "update_task",
  description:
    "Update work in this project's task system. You may reword it, sharpen its acceptance criteria, or move it to backlog, review, or cancelled. You cannot queue or finish a task — dispatch does the first and a person accepts the second.",
  type: "normal",
  costPerCall: 0,
  permissions: ["write"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: { type: "string", description: "The id of the task to update." },
      objective: { type: "string", description: "A replacement objective." },
      acceptanceCriteria: {
        type: "array",
        description: "Replacement checkable completion criteria.",
        items: { type: "string" },
      },
      status: {
        type: "string",
        description: `One of: ${MODEL_SETTABLE_STATUSES.join(", ")}.`,
        enum: MODEL_SETTABLE_STATUSES,
      },
    },
    required: ["taskId"],
    additionalProperties: false,
  }),
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
