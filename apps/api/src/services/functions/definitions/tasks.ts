import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const MAX_TASK_LIMIT = 10;

export const get_task_status: FunctionToolDescriptor = {
  name: "get_task_status",
  description:
    "Report the status of the user's background tasks, such as queued recipe runs. Pass taskId for one specific task, or omit it to list the most recent tasks.",
  type: "normal",
  costPerCall: 0,
  permissions: ["read"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "Optional id of a single task to report on.",
      },
      limit: {
        type: "number",
        description: `Optional number of recent tasks to list, up to ${MAX_TASK_LIMIT}.`,
      },
    },
    additionalProperties: false,
  }),
};
