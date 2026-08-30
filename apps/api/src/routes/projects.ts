import {
  addProjectCapabilitySchema,
  authoredSkillDocumentSchema,
  authoredSkillInputSchema,
  authoredSkillListResponseSchema,
  createProjectTaskSchema,
  errorResponseSchema,
  projectDetailSchema,
  projectFlowResponseSchema,
  projectTaskListQuerySchema,
  projectTaskListResponseSchema,
  projectTaskDetailResponseSchema,
  projectTaskResponseSchema,
  setProjectFlowSchema,
  skillIdSchema,
  updateProjectSchema,
  updateProjectTaskSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  acceptProjectTask,
  createProjectTask,
  deleteProjectTask,
  getProjectFlow,
  getProjectTask,
  listProjectTasks,
  setProjectFlow,
  startProjectTask,
  updateProjectTask,
} from "~/services/project-tasks";
import {
  deleteProjectSkill,
  getProjectSkill,
  listProjectSkills,
  publishProjectSkill,
  updateProjectSkill,
} from "~/services/skills";
import {
  addProjectCapability,
  archiveProject,
  getProject,
  removeProjectCapability,
  updateProject,
} from "~/services/workspaces";

const app = new Hono();
const projectParams = z.object({ projectId: z.string().min(1) });

addRoute(app, "get", "/:projectId", {
  auth: true,
  tags: ["projects"],
  summary: "Get a project work surface",
  paramSchema: projectParams,
  responses: { 200: { description: "Project details", schema: projectDetailSchema } },
  handler: ({ serviceContext, params }) => getProject(serviceContext, params.projectId),
});

addRoute(app, "put", "/:projectId", {
  auth: true,
  tags: ["projects"],
  summary: "Update a project",
  paramSchema: projectParams,
  bodySchema: updateProjectSchema,
  responses: { 200: { description: "Updated project", schema: projectDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateProject(serviceContext, params.projectId, body),
});

addRoute(app, "delete", "/:projectId", {
  auth: true,
  tags: ["projects"],
  summary: "Archive a project",
  paramSchema: projectParams,
  handler: ({ serviceContext, params }) => archiveProject(serviceContext, params.projectId),
});

addRoute(app, "post", "/:projectId/capabilities", {
  auth: true,
  tags: ["projects"],
  summary: "Add an app, recipe, or tool to a project",
  paramSchema: projectParams,
  bodySchema: addProjectCapabilitySchema,
  responses: { 200: { description: "Updated project", schema: projectDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    addProjectCapability(serviceContext, params.projectId, body),
});

addRoute(app, "delete", "/:projectId/capabilities/:capabilityId", {
  auth: true,
  tags: ["projects"],
  summary: "Remove a capability from a project",
  paramSchema: projectParams.extend({ capabilityId: z.string().min(1) }),
  responses: { 200: { description: "Updated project", schema: projectDetailSchema } },
  handler: ({ serviceContext, params }) =>
    removeProjectCapability(serviceContext, params.projectId, params.capabilityId),
});

addRoute(app, "get", "/:projectId/skills", {
  auth: true,
  tags: ["projects", "skills"],
  summary: "List published project skills",
  paramSchema: projectParams,
  responses: {
    200: { description: "Published skills", schema: authoredSkillListResponseSchema },
  },
  handler: ({ serviceContext, params }) => listProjectSkills(serviceContext, params.projectId),
});

addRoute(app, "post", "/:projectId/skills", {
  auth: true,
  tags: ["projects", "skills"],
  summary: "Publish a skill to a project",
  paramSchema: projectParams,
  bodySchema: authoredSkillInputSchema,
  responses: {
    200: { description: "Published skill", schema: authoredSkillDocumentSchema },
    400: { description: "Invalid skill document", schema: errorResponseSchema },
    403: { description: "Project admin access required", schema: errorResponseSchema },
    409: { description: "Skill name already exists", schema: errorResponseSchema },
  },
  handler: ({ body, params, serviceContext, user }) =>
    publishProjectSkill(serviceContext, user.id, params.projectId, body),
});

const projectSkillParams = projectParams.extend({ skillId: skillIdSchema });

addRoute(app, "get", "/:projectId/skills/:skillId", {
  auth: true,
  tags: ["projects", "skills"],
  summary: "Get a published project skill",
  paramSchema: projectSkillParams,
  responses: {
    200: { description: "Published skill", schema: authoredSkillDocumentSchema },
    404: { description: "Skill not found", schema: errorResponseSchema },
  },
  handler: ({ params, serviceContext }) =>
    getProjectSkill(serviceContext, params.projectId, params.skillId),
});

addRoute(app, "put", "/:projectId/skills/:skillId", {
  auth: true,
  tags: ["projects", "skills"],
  summary: "Update a published project skill",
  paramSchema: projectSkillParams,
  bodySchema: authoredSkillInputSchema,
  responses: {
    200: { description: "Updated skill", schema: authoredSkillDocumentSchema },
    400: { description: "Invalid skill document", schema: errorResponseSchema },
    403: { description: "Project admin access required", schema: errorResponseSchema },
    404: { description: "Skill not found", schema: errorResponseSchema },
  },
  handler: ({ body, params, serviceContext, user }) =>
    updateProjectSkill(serviceContext, user.id, params.projectId, params.skillId, body),
});

addRoute(app, "delete", "/:projectId/skills/:skillId", {
  auth: true,
  tags: ["projects", "skills"],
  summary: "Unpublish a project skill",
  paramSchema: projectSkillParams,
  responses: {
    403: { description: "Project admin access required", schema: errorResponseSchema },
    404: { description: "Skill not found", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext, user }) => {
    await deleteProjectSkill(serviceContext, user.id, params.projectId, params.skillId);

    return { success: true };
  },
});

const projectTaskParams = projectParams.extend({ taskId: z.string().min(1) });

addRoute(app, "get", "/:projectId/tasks", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "List project tasks",
  paramSchema: projectParams,
  querySchema: projectTaskListQuerySchema,
  responses: {
    200: { description: "Tasks and the project flow", schema: projectTaskListResponseSchema },
  },
  handler: ({ serviceContext, params, query }) =>
    listProjectTasks(serviceContext, params.projectId, query),
});

addRoute(app, "post", "/:projectId/tasks", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Add a task to the project board",
  paramSchema: projectParams,
  bodySchema: createProjectTaskSchema,
  responses: {
    200: { description: "The created task", schema: projectTaskResponseSchema },
    400: { description: "Invalid task", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    createProjectTask(serviceContext, params.projectId, body),
});

addRoute(app, "get", "/:projectId/tasks/:taskId", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Get one project task",
  paramSchema: projectTaskParams,
  responses: {
    200: {
      description: "The task and its latest run goal",
      schema: projectTaskDetailResponseSchema,
    },
    404: { description: "Task not found", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params }) =>
    getProjectTask(serviceContext, params.projectId, params.taskId),
});

addRoute(app, "patch", "/:projectId/tasks/:taskId", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Update a project task",
  paramSchema: projectTaskParams,
  bodySchema: updateProjectTaskSchema,
  responses: {
    200: { description: "The updated task", schema: projectTaskResponseSchema },
    403: { description: "Transition not allowed", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    updateProjectTask(serviceContext, params.projectId, params.taskId, body),
});

addRoute(app, "post", "/:projectId/tasks/:taskId/start", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Queue a project task for its runner",
  description:
    "The caller becomes the run's identity: it executes with their connections and installations.",
  paramSchema: projectTaskParams,
  responses: {
    200: { description: "The queued task", schema: projectTaskResponseSchema },
    409: { description: "Too many tasks already in flight", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params }) =>
    startProjectTask(serviceContext, params.projectId, params.taskId),
});

addRoute(app, "post", "/:projectId/tasks/:taskId/accept", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Accept a reviewed task",
  description: "Moves the task to done, or to the next flow stage when the project has one.",
  paramSchema: projectTaskParams,
  responses: {
    200: { description: "The accepted task", schema: projectTaskResponseSchema },
    400: { description: "The task is not in review", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params }) =>
    acceptProjectTask(serviceContext, params.projectId, params.taskId),
});

addRoute(app, "delete", "/:projectId/tasks/:taskId", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Delete a project task",
  paramSchema: projectTaskParams,
  handler: ({ serviceContext, params }) =>
    deleteProjectTask(serviceContext, params.projectId, params.taskId),
});

addRoute(app, "get", "/:projectId/flow", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Get the project flow",
  paramSchema: projectParams,
  responses: { 200: { description: "The flow", schema: projectFlowResponseSchema } },
  handler: ({ serviceContext, params }) => getProjectFlow(serviceContext, params.projectId),
});

addRoute(app, "put", "/:projectId/flow", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Set or clear the project flow",
  paramSchema: projectParams,
  bodySchema: setProjectFlowSchema,
  responses: {
    200: { description: "The stored flow", schema: projectFlowResponseSchema },
    400: { description: "Invalid flow", schema: errorResponseSchema },
    403: { description: "Project admin access required", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    setProjectFlow(serviceContext, params.projectId, body.flow),
});

export default app;
