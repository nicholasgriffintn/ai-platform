import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import type { ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

export const MODEL_SETTABLE_STATUSES: ProjectTaskStatus[] = ["backlog", "review", "cancelled"];

export const create_task: FunctionToolDescriptor = {
  name: "create_task",
  description:
    "Add work to this project's task system. Use it when the person describes work to do, or when you split a task into sub-tasks with parentTaskId. Tasks without an owner wait in the backlog. Give a teammate owner to hand the work over at once.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input) => ({
    operation: "create_task",
    objective: input.objective,
    acceptanceCriteria: input.acceptanceCriteria,
    expectedOutput: input.expectedOutput,
    stageId: input.stageId,
  }),
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
      assumptions: {
        type: "array",
        description:
          "What has to be true for this plan to be worth doing, one statement each. They are checked against the outcome when the task finishes.",
        items: { type: "string" },
      },
      killConditions: {
        type: "array",
        description:
          "Evidence that should stop the work, one condition each, decided now rather than once invested. Checked after every run.",
        items: { type: "string" },
      },
      stageId: {
        type: "string",
        description: "Optional flow stage id to start the task in.",
      },
      description: {
        type: "string",
        description: "Longer detail for the people and teammates who pick this up.",
      },
      owner: {
        type: "string",
        description:
          "Who owns it: a teammate's name, or a person's name or email. A teammate owner wakes and starts straight away.",
      },
      parentTaskId: {
        type: "string",
        description: "Key or id of the parent task, when this is a sub-task. Three levels at most.",
      },
      priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
      dueAt: { type: "string", description: "Due date as an ISO 8601 date-time." },
    },
    required: ["objective"],
    additionalProperties: false,
  }),
};

export const list_tasks: FunctionToolDescriptor = {
  name: "list_tasks",
  description:
    "List this project's work queue so you can see what is already captured, running, or waiting on a person. Check this before creating a task that may already exist.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
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
};

export const get_task: FunctionToolDescriptor = {
  name: "get_task",
  description:
    "Get one task from this project, including its acceptance criteria, execution state, and goal evidence. Use it before changing a task or when the person asks about one exact task.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: { type: "string", description: "The exact id of the task to retrieve." },
    },
    required: ["taskId"],
    additionalProperties: false,
  }),
};

export const update_task: FunctionToolDescriptor = {
  name: "update_task",
  description:
    "Update work in this project's task system. You may reword it, sharpen its acceptance criteria, record the assumptions and kill conditions a plan rests on, or move it to backlog, review, or cancelled. You cannot queue or finish a task — dispatch does the first and a person accepts the second.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input) => ({ operation: "update_task", ...input }),
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
      assumptions: {
        type: "array",
        description:
          "Replacement list of what has to be true for this plan to be worth doing, one statement each. They are checked against the outcome when the task finishes.",
        items: { type: "string" },
      },
      killConditions: {
        type: "array",
        description:
          "Replacement list of evidence that should stop the work, one condition each, decided now rather than once invested. Checked after every run.",
        items: { type: "string" },
      },
      status: {
        type: "string",
        description: `One of: ${MODEL_SETTABLE_STATUSES.join(", ")}.`,
        enum: MODEL_SETTABLE_STATUSES,
      },
      description: { type: "string", description: "Replacement detail." },
      priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
      dueAt: { type: "string", description: "Due date as an ISO 8601 date-time." },
    },
    required: ["taskId"],
    additionalProperties: false,
  }),
};
