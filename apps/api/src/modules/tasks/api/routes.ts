import { listTasksResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { cancelUserTask, getUserTask, listUserTasks } from "~/modules/tasks/application";

const app = new Hono();
const taskParamsSchema = z.object({ task_id: z.string().min(1) });

defineResource(app, { idParam: "task_id", tags: ["tasks"] }, (tasks) => {
  tasks
    .list({
      auth: true,
      summary: "List the caller's background tasks",
      responses: { 200: { description: "Tasks", schema: listTasksResponseSchema } },
      handler: ({ serviceContext, user }) => listUserTasks(serviceContext, user.id),
    })
    .read({
      auth: true,
      summary: "Read a background task and its executions",
      paramSchema: taskParamsSchema,
      handler: ({ params, serviceContext, user }) =>
        getUserTask(serviceContext, user.id, params.task_id),
    })
    .action("cancel", {
      auth: true,
      summary: "Cancel a background task",
      paramSchema: taskParamsSchema,
      handler: ({ params, serviceContext, user }) =>
        cancelUserTask(serviceContext, user.id, params.task_id),
    });
});

export default app;
