import {
  projectTaskStatusLabels,
  type ProjectTask,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";

import { createProjectTask, listProjectTasks, updateProjectTask } from "~/services/project-tasks";
import type { IRequest } from "~/types";

import type { ApiToolDefinition } from "../../types/functions";
import { jsonSchemaToZod } from "../../utils/jsonSchema";
import { resolveRequestProjectId } from "./request-context";

const MAX_LISTED_TASKS = 25;

const MODEL_SETTABLE_STATUSES: ProjectTaskStatus[] = ["backlog", "queued", "review", "cancelled"];

function formatTask(task: ProjectTask): string {
  const stage = task.stageId ? ` [${task.stageId}]` : "";
  const blocked = task.blockedDetail ? ` — ${task.blockedDetail}` : "";

  return `${task.id}${stage}: ${task.objective} (${projectTaskStatusLabels[task.status]})${blocked}`;
}

function requireProjectId(request: IRequest): string {
  const projectId = resolveRequestProjectId(request);

  if (!projectId) {
    throw new Error(
      "Task board tools are only available in a project conversation. Ask the person to open the project first.",
    );
  }

  return projectId;
}

export const create_task: ApiToolDefinition = {
  name: "create_task",
  description:
    "Add a task to this project's board so the work is captured outside this conversation. Use it when the person describes work to do later, or when you split an objective into separate pieces. Tasks start in the backlog and nobody runs them until a person says so.",
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
      acceptance: {
        type: "string",
        description: "How someone would tell the task is genuinely finished.",
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
      throw new Error("Signed-in project context is required for task board tools");
    }

    const { task } = await createProjectTask(
      request.context,
      projectId,
      {
        objective: String(args.objective ?? "").trim(),
        acceptance: typeof args.acceptance === "string" ? args.acceptance.trim() : null,
        stageId: typeof args.stageId === "string" ? args.stageId : null,
      },
      { source: "model" },
    );

    return {
      status: "success",
      name: "create_task",
      content: `Added to the board: ${formatTask(task)}`,
      data: { task },
    };
  },
};

export const list_tasks: ApiToolDefinition = {
  name: "list_tasks",
  description:
    "List this project's task board so you can see what is already captured, running, or waiting on a person. Check this before creating a task that may already exist.",
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
      throw new Error("Signed-in project context is required for task board tools");
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
        ? `Board:\n${visible.map(formatTask).join("\n")}`
        : "This board has no tasks matching that filter.",
      data: { tasks: visible, total: tasks.length },
    };
  },
};

export const update_task: ApiToolDefinition = {
  name: "update_task",
  description:
    "Update a task on this project's board. You may reword it, sharpen its acceptance criteria, or move it to backlog, queued, review, or cancelled. You cannot mark a task done — a person accepts finished work.",
  type: "normal",
  costPerCall: 0,
  permissions: ["write"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: { type: "string", description: "The id of the task to update." },
      objective: { type: "string", description: "A replacement objective." },
      acceptance: {
        type: "string",
        description: "Replacement acceptance criteria.",
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
      throw new Error("Signed-in project context is required for task board tools");
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
        ...(typeof args.acceptance === "string" ? { acceptance: args.acceptance.trim() } : {}),
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
