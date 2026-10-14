import {
  addProjectCapabilitySchema,
  createProjectRequestSchema,
  listPageOf,
  projectDetailSchema,
  projectFlowResponseSchema,
  sandboxEnvironmentCacheActionResponseSchema,
  sandboxEnvironmentVariableInputSchema,
  sandboxEnvironmentVariableNameSchema,
  sandboxEnvironmentVariablesResponseSchema,
  setProjectFlowSchema,
  updateProjectSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import {
  defineProjectImports,
  defineProjectReviews,
} from "~/modules/project-tasks/api/integrations";
import { defineProjectTasks } from "~/modules/project-tasks/api/tasks";
import { getProjectFlow, setProjectFlow } from "~/modules/project-tasks/application";
import {
  addProjectCapability,
  archiveProject,
  clearProjectEnvironmentVariable,
  createProject,
  getProject,
  listProjectEnvironmentVariables,
  removeProjectCapability,
  setProjectEnvironmentVariable,
  updateProject,
} from "~/modules/workspaces/application";
import { applyProjectEnvironmentCacheAction } from "~/modules/workspaces/application/environment-cache";

const app = new Hono();
const projectParamsSchema = z.object({ project_id: z.string().min(1) });

defineResource(app, { idParam: "project_id", tags: ["projects"] }, (projects) => {
  projects
    .create({
      auth: true,
      summary: "Create a project in a workspace",
      bodySchema: createProjectRequestSchema,
      responses: { 200: { description: "The project", schema: projectDetailSchema } },
      handler: ({ serviceContext, body: { workspace_id, ...input } }) =>
        createProject(serviceContext, workspace_id, input),
    })
    .read({
      auth: true,
      summary: "Get a project work surface",
      paramSchema: projectParamsSchema,
      responses: { 200: { description: "The project", schema: projectDetailSchema } },
      handler: ({ serviceContext, params }) => getProject(serviceContext, params.project_id),
    })
    .update({
      auth: true,
      summary: "Update a project",
      paramSchema: projectParamsSchema,
      bodySchema: updateProjectSchema,
      responses: { 200: { description: "The project", schema: projectDetailSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateProject(serviceContext, params.project_id, body),
    })
    .delete({
      auth: true,
      summary: "Archive a project",
      paramSchema: projectParamsSchema,
      handler: ({ serviceContext, params }) => archiveProject(serviceContext, params.project_id),
    });

  projects
    .singleton("environment_cache")
    .create({
      auth: true,
      summary: "Rebuild the project environment cache",
      paramSchema: projectParamsSchema,
      responses: {
        200: { description: "Cache result", schema: sandboxEnvironmentCacheActionResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        applyProjectEnvironmentCacheAction(serviceContext, params.project_id, {
          action: "rebuild",
        }),
    })
    .delete({
      auth: true,
      summary: "Delete the project environment cache",
      paramSchema: projectParamsSchema,
      responses: {
        200: { description: "Cache result", schema: sandboxEnvironmentCacheActionResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        applyProjectEnvironmentCacheAction(serviceContext, params.project_id, {
          action: "delete",
        }),
    });

  projects
    .sub("environment_variables", "variable_id")
    .list({
      auth: true,
      summary: "List project environment variable names",
      description: "Values are write-only; the list carries names and metadata.",
      paramSchema: projectParamsSchema,
      handler: async ({ serviceContext, params }) =>
        listPageOf(
          (await listProjectEnvironmentVariables(serviceContext, params.project_id)).variables,
          (variable) => variable.name,
        ),
    })
    .create({
      auth: true,
      summary: "Set a project environment variable",
      paramSchema: projectParamsSchema,
      bodySchema: sandboxEnvironmentVariableInputSchema,
      responses: {
        200: { description: "Variable names", schema: sandboxEnvironmentVariablesResponseSchema },
      },
      handler: ({ serviceContext, params, body }) =>
        setProjectEnvironmentVariable(serviceContext, params.project_id, body),
    })
    .delete({
      auth: true,
      summary: "Clear a project environment variable",
      paramSchema: projectParamsSchema.extend({
        variable_id: sandboxEnvironmentVariableNameSchema,
      }),
      responses: {
        200: { description: "Variable names", schema: sandboxEnvironmentVariablesResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        clearProjectEnvironmentVariable(serviceContext, params.project_id, params.variable_id),
    });

  projects
    .sub("capabilities", "capability_id")
    .create({
      auth: true,
      summary: "Add an app, recipe or tool to a project",
      paramSchema: projectParamsSchema,
      bodySchema: addProjectCapabilitySchema,
      responses: { 200: { description: "The project", schema: projectDetailSchema } },
      handler: ({ serviceContext, params, body }) =>
        addProjectCapability(serviceContext, params.project_id, body),
    })
    .delete({
      auth: true,
      summary: "Remove a capability from a project",
      paramSchema: projectParamsSchema.extend({ capability_id: z.string().min(1) }),
      responses: { 200: { description: "The project", schema: projectDetailSchema } },
      handler: ({ serviceContext, params }) =>
        removeProjectCapability(serviceContext, params.project_id, params.capability_id),
    });

  projects
    .singleton("flow")
    .read({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Get the project flow",
      paramSchema: projectParamsSchema,
      responses: { 200: { description: "The flow", schema: projectFlowResponseSchema } },
      handler: ({ serviceContext, params }) => getProjectFlow(serviceContext, params.project_id),
    })
    .update({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Set or clear the project flow",
      paramSchema: projectParamsSchema,
      bodySchema: setProjectFlowSchema,
      responses: { 200: { description: "The flow", schema: projectFlowResponseSchema } },
      handler: ({ serviceContext, params, body }) =>
        setProjectFlow(serviceContext, params.project_id, body.flow),
    });

  defineProjectTasks(projects);
  defineProjectReviews(projects);
  defineProjectImports(projects);
});

export default app;
