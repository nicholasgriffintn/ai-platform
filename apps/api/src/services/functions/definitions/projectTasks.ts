import type { ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const MODEL_SETTABLE_STATUSES: ProjectTaskStatus[] = ["backlog", "review", "cancelled"];

export const create_task: FunctionToolDescriptor = {
  name: "create_task",
  description:
    "Add work to this project's task system so it is captured outside this conversation. Use it when the person describes work to do later, or when you split an objective into separate pieces. Tasks start in the backlog and nobody runs them until a person says so.",
  type: "normal",
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
};

export const list_tasks: FunctionToolDescriptor = {
  name: "list_tasks",
  description:
    "List this project's work queue so you can see what is already captured, running, or waiting on a person. Check this before creating a task that may already exist.",
  type: "normal",
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
};

export const get_task: FunctionToolDescriptor = {
  name: "get_task",
  description:
    "Get one task from this project, including its acceptance criteria, execution state, and goal evidence. Use it before changing a task or when the person asks about one exact task.",
  type: "normal",
  permissions: ["read"],
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
    "Update work in this project's task system. You may reword it, sharpen its acceptance criteria, or move it to backlog, review, or cancelled. You cannot queue or finish a task — dispatch does the first and a person accepts the second.",
  type: "normal",
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
};
