import {
  acceptTaskBreakdownSchema,
  answerStandupSchema,
  createProjectTaskLinkSchema,
  createProjectTaskSchema,
  listPageOf,
  projectTaskCommentSchema,
  projectTaskDetailResponseSchema,
  projectTaskLinkSchema,
  projectTaskListQuerySchema,
  projectTaskListResponseSchema,
  projectTaskResponseSchema,
  projectTaskReviewResponseSchema,
  projectTaskThreadPostSchema,
  projectTaskThreadResponseSchema,
  raiseCaseSchema,
  resolveCaseSchema,
  sendCaseReplySchema,
  standupSettingsSchema,
  updateProjectTaskSchema,
  workActorSchema,
  workAssignSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ResourceBuilder } from "~/infrastructure/http/resource";
import {
  acceptProjectTask,
  createProjectTask,
  deleteProjectTask,
  getProjectTask,
  getProjectTaskThread,
  listProjectTasks,
  sendProjectTaskAgain,
  startProjectTask,
  updateProjectTask,
} from "~/modules/project-tasks/application";
import { acceptTaskBreakdown } from "~/modules/project-tasks/application/breakdown";
import { sendCaseReply } from "~/modules/project-tasks/application/case-intake";
import { getProjectTaskReview } from "~/modules/project-tasks/application/pull-request-review";
import {
  answerStandup,
  getStandupDraft,
  getStandupSettings,
  setStandupSettings,
} from "~/modules/project-tasks/application/standups";
import {
  assignTask,
  blockTask,
  clearEscalation,
  commentOnTask,
  escalateTask,
  linkTasks,
  personCaller,
  raiseCase,
  requestReview,
  resolveCase,
  reviewTask,
  unlinkTasks,
} from "~/modules/project-tasks/application/work";

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
          kind: query.kind,
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

  tasks.action("comment", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Comment on a task",
    description: "Posts to the task thread. Mentioning a teammate with @name wakes it.",
    paramSchema: taskParamsSchema,
    bodySchema: projectTaskCommentSchema,
    responses: {
      200: { description: "The post", schema: z.object({ post: projectTaskThreadPostSchema }) },
    },
    handler: async ({ serviceContext, params, body }) => ({
      post: await commentOnTask(serviceContext, params.project_id, params.task_id, body.body),
    }),
  });

  tasks.action("assign", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Hand a task to a teammate or person",
    description: "A teammate owner wakes and starts straight away under the caller's authority.",
    paramSchema: taskParamsSchema,
    bodySchema: workAssignSchema,
    responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await assignTask(
        serviceContext,
        params.project_id,
        params.task_id,
        body.owner,
        personCaller(serviceContext),
      ),
    }),
  });

  tasks.action("request_review", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Send a task for review",
    paramSchema: taskParamsSchema,
    bodySchema: z.object({
      reviewer: workActorSchema,
      note: z.string().trim().max(2000).nullable().default(null),
    }),
    responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await requestReview(
        serviceContext,
        params.project_id,
        params.task_id,
        body.reviewer,
        body.note,
        personCaller(serviceContext),
      ),
    }),
  });

  tasks.action("review", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Accept a task or ask for changes",
    paramSchema: taskParamsSchema,
    bodySchema: z.object({
      decision: z.enum(["accept", "changes"]),
      note: z.string().trim().max(4000).default(""),
    }),
    responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await reviewTask(
        serviceContext,
        params.project_id,
        params.task_id,
        body.decision,
        body.note,
        personCaller(serviceContext),
      ),
    }),
  });

  tasks.action("block", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Block a task on someone",
    paramSchema: taskParamsSchema,
    bodySchema: z.object({ reason: z.string().trim().min(1).max(500), unblocker: workActorSchema }),
    responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await blockTask(
        serviceContext,
        params.project_id,
        params.task_id,
        body.reason,
        body.unblocker,
        personCaller(serviceContext),
      ),
    }),
  });

  tasks.action("accept_breakdown", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Accept a proposed breakdown",
    description:
      "Creates the sub-tasks of the given breakdown revision with their blockers and starts the ones that are ready.",
    paramSchema: taskParamsSchema,
    bodySchema: acceptTaskBreakdownSchema,
    responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await acceptTaskBreakdown(
        serviceContext,
        params.project_id,
        params.task_id,
        body.revision,
        personCaller(serviceContext),
      ),
    }),
  });

  tasks.action("escalate", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Escalate a task",
    paramSchema: taskParamsSchema,
    bodySchema: z.object({ reason: z.string().trim().min(1).max(2000) }),
    responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await escalateTask(
        serviceContext,
        params.project_id,
        params.task_id,
        body.reason,
        personCaller(serviceContext),
      ),
    }),
  });

  tasks.action("send_again", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Send a stuck task to the queue again",
    description:
      "Redelivers the task's current run when its message was lost or its worker stopped. A run that is still going is left alone.",
    paramSchema: taskParamsSchema,
    responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params }) => ({
      task: await sendProjectTaskAgain(serviceContext, params.project_id, params.task_id),
    }),
  });

  tasks.action("clear_escalation", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Mark an escalation handled",
    paramSchema: taskParamsSchema,
    responses: { 200: { description: "The task", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params }) => ({
      task: await clearEscalation(serviceContext, params.project_id, params.task_id),
    }),
  });

  tasks.action("resolve", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Resolve a case",
    paramSchema: taskParamsSchema,
    bodySchema: resolveCaseSchema,
    responses: { 200: { description: "The case", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await resolveCase(serviceContext, params.project_id, params.task_id, body.resolution),
    }),
  });

  tasks.action("send_reply", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Send a reply to the person who raised a case",
    description: "Sends through the channel the case arrived on. A person always sends it.",
    paramSchema: taskParamsSchema,
    bodySchema: sendCaseReplySchema,
    responses: { 200: { description: "The case", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await sendCaseReply(serviceContext, params.project_id, params.task_id, body.body),
    }),
  });

  tasks.action("answer_standup", {
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Answer a standup",
    paramSchema: taskParamsSchema,
    bodySchema: answerStandupSchema,
    responses: { 200: { description: "The standup", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await answerStandup(
        serviceContext,
        params.project_id,
        params.task_id,
        body,
        personCaller(serviceContext),
      ),
    }),
  });

  tasks.singleton("thread").read({
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Read a task's thread",
    description: "Comments, teammate updates and events on the task, oldest first.",
    paramSchema: taskParamsSchema,
    responses: { 200: { description: "The thread", schema: projectTaskThreadResponseSchema } },
    handler: ({ serviceContext, params }) =>
      getProjectTaskThread(serviceContext, params.project_id, params.task_id),
  });

  tasks.singleton("standup_draft").read({
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Draft standup answers from the caller's activity",
    paramSchema: taskParamsSchema,
    responses: { 200: { description: "Draft answers", schema: answerStandupSchema } },
    handler: ({ serviceContext, params }) =>
      getStandupDraft(serviceContext, params.project_id, params.task_id),
  });

  tasks
    .sub("links", "link_id")
    .create({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Link two tasks",
      paramSchema: taskParamsSchema,
      bodySchema: createProjectTaskLinkSchema,
      responses: {
        200: { description: "The link", schema: z.object({ link: projectTaskLinkSchema }) },
      },
      handler: async ({ serviceContext, params, body }) => ({
        link: await linkTasks(
          serviceContext,
          params.project_id,
          params.task_id,
          body.toTaskId,
          body.kind,
        ),
      }),
    })
    .delete({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Remove a task link",
      paramSchema: taskParamsSchema.extend({ link_id: z.string().min(1) }),
      handler: ({ serviceContext, params }) =>
        unlinkTasks(serviceContext, params.project_id, params.task_id, params.link_id),
    });

  projects.sub("cases", "case_id").create({
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Raise a case",
    description: "Sends a problem or request to the project's Triage, optionally linked to a task.",
    paramSchema: projectParamsSchema,
    bodySchema: raiseCaseSchema,
    responses: { 200: { description: "The case", schema: projectTaskResponseSchema } },
    handler: async ({ serviceContext, params, body }) => ({
      task: await raiseCase(serviceContext, params.project_id, body, personCaller(serviceContext)),
    }),
  });

  projects
    .singleton("standup")
    .read({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Read the project's standup settings",
      paramSchema: projectParamsSchema,
      responses: { 200: { description: "Standup settings", schema: standupSettingsSchema } },
      handler: ({ serviceContext, params }) =>
        getStandupSettings(serviceContext, params.project_id),
    })
    .update({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Change the project's standup settings",
      paramSchema: projectParamsSchema,
      bodySchema: standupSettingsSchema,
      responses: { 200: { description: "Standup settings", schema: standupSettingsSchema } },
      handler: ({ serviceContext, params, body }) =>
        setStandupSettings(serviceContext, params.project_id, body),
    });
}
