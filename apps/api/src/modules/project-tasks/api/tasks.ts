import {
  createProjectTaskSchema,
  listPageOf,
  projectTaskDetailResponseSchema,
  projectTaskListQuerySchema,
  projectTaskListResponseSchema,
  projectTaskResponseSchema,
  projectTaskReviewResponseSchema,
  updateProjectTaskSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ResourceBuilder } from "~/infrastructure/http/resource";
import {
  acceptProjectTask,
  createProjectTask,
  deleteProjectTask,
  getProjectTask,
  listProjectTasks,
  startProjectTask,
  updateProjectTask,
} from "~/modules/project-tasks/application";
import { getProjectTaskReview } from "~/modules/project-tasks/application/pull-request-review";

const projectParamsSchema = z.object({ project_id: z.string().min(1) });
const taskParamsSchema = projectParamsSchema.extend({ task_id: z.string().min(1) });

export function defineProjectTasks(projects: ResourceBuilder): void {
  const tasks = projects.sub("tasks", "task_id");

  tasks
    .list({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "List project tasks",
      description: "The project board, with the project flow alongside.",
      paramSchema: projectParamsSchema,
      querySchema: projectTaskListQuerySchema,
      responses: { 200: { description: "Tasks", schema: projectTaskListResponseSchema } },
      handler: async ({ serviceContext, params, query }) => {
        const { tasks: rows, flow } = await listProjectTasks(serviceContext, params.project_id, {
          status: query.status,
          assigneeUserId: query.assignee_user_id,
          includeDone: query.include_done,
        });

        return { ...listPageOf(rows, (task) => task.id), flow };
      },
    })
    .create({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Add a task to the project board",
      paramSchema: projectParamsSchema,
      bodySchema: createProjectTaskSchema,
      responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
      handler: ({ serviceContext, params, body }) =>
        createProjectTask(serviceContext, params.project_id, body),
    })
    .read({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Get one project task",
      paramSchema: taskParamsSchema,
      responses: {
        200: { description: "The task and its run", schema: projectTaskDetailResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        getProjectTask(serviceContext, params.project_id, params.task_id),
    })
    .update({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Update a project task",
      paramSchema: taskParamsSchema,
      bodySchema: updateProjectTaskSchema,
      responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateProjectTask(serviceContext, params.project_id, params.task_id, body),
    })
    .delete({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Delete a project task",
      paramSchema: taskParamsSchema,
      handler: ({ serviceContext, params }) =>
        deleteProjectTask(serviceContext, params.project_id, params.task_id),
    })
    .action("start", {
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Queue a project task for its runner",
      description:
        "The caller becomes the run's identity: it executes with their connections and installations.",
      paramSchema: taskParamsSchema,
      responses: { 200: { description: "The queued task", schema: projectTaskResponseSchema } },
      handler: ({ serviceContext, params }) =>
        startProjectTask(serviceContext, params.project_id, params.task_id),
    })
    .action("accept", {
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Accept a reviewed task",
      description: "Moves the task to done, or to the next flow stage when the project has one.",
      paramSchema: taskParamsSchema,
      responses: { 200: { description: "The accepted task", schema: projectTaskResponseSchema } },
      handler: ({ serviceContext, params }) =>
        acceptProjectTask(serviceContext, params.project_id, params.task_id),
    });

  tasks.singleton("review").read({
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Read the pull request review for a task",
    paramSchema: taskParamsSchema,
    responses: { 200: { description: "Task review", schema: projectTaskReviewResponseSchema } },
    handler: ({ serviceContext, params }) =>
      getProjectTaskReview(serviceContext, params.project_id, params.task_id),
  });
}
