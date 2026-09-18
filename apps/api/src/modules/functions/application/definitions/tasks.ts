import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import { MAX_TASK_LIMIT } from "~/config/limits";

import type { FunctionToolDescriptor } from "./types";

export const get_task_status: FunctionToolDescriptor = {
  name: "get_task_status",
  description:
    "Report the status of the user's background tasks, such as queued recipe runs. Pass taskId for one specific task, or omit it to list the most recent tasks.",
  type: "normal",
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
