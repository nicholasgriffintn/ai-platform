import {
  teammateListResponseSchema,
  teammateResponseSchema,
  createTeammateSchema,
  hireTeammateSchema,
  recordTeammateFeedbackSchema,
  updateTeammateSchema,
  createChatCompletionsJsonSchema,
  publishTeammateToWorkspaceSchema,
  apiResponseSchema,
  ensureTeammateContextSchema,
  teammateConnectionGrantListResponseSchema,
  teammateConnectionGrantSchema,
  teammateContextListResponseSchema,
  teammateContextSchema,
  updateTeammateContextStatusSchema,
  upsertTeammateConnectionGrantSchema,
  teammateComputerActionResponseSchema,
  teammateComputerActionSchema,
  teammateComputerSchema,
  teammateComputerTakeoverInputSchema,
  teammateComputerTakeoverResponseSchema,
  memoryDocumentSchema,
  updateMemoryDocumentSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { requireCloudflareExecutionContext } from "~/lib/cloudflare/execution-context";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  getUserTeammates,
  getTeammateById,
  createTeammate,
  hireTeammate,
  recordTeammateFeedback,
  removeInheritedTeammateFromProject,
  restoreInheritedTeammateToProject,
  updateTeammate,
  deleteTeammate,
  enqueueTeammateRun,
  publishTeammateToWorkspace,
  ensureTeammateContext,
  listTeammateConnectionGrants,
  listTeammateContexts,
  upsertTeammateConnectionGrant,
  getTeammateComputer,
  performTeammateComputerAction,
  releaseTeammateComputer,
  takeOverTeammateComputer,
  resumeTeammateRun,
  getTeammateContextMemory,
  updateTeammateContextMemory,
  updateTeammateContextStatus,
} from "~/services/teammates";
import type { IEnv } from "~/types";

import sharedTeammates from "./shared";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("teammates");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing teammates route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

const teammateIdParamSchema = z.object({ teammateId: z.string().min(1) });

addRoute(app, "get", "/", {
  tags: ["teammates"],
  summary: "Get all teammates",
  description: "Get all teammates for the current user",
  auth: true,
  responses: {
    200: { description: "Agents", schema: teammateListResponseSchema },
  },
  handler: async ({ serviceContext }) => {
    return getUserTeammates(serviceContext);
  },
});

addRoute(app, "post", "/", {
  tags: ["teammates"],
  summary: "Create an teammate",
  description: "Create an teammate for the current user",
  auth: true,
  bodySchema: createTeammateSchema,
  responses: {
    200: { description: "Created teammate", schema: teammateResponseSchema },
  },
  handler: async ({ serviceContext, body }) => {
    return createTeammate(serviceContext, body);
  },
});

addRoute(app, "post", "/hire", {
  tags: ["teammates"],
  summary: "Hire a teammate",
  description:
    "Create a teammate from a built-in role, a job description, or both. The role supplies the brief, suggested tools and kind.",
  auth: true,
  bodySchema: hireTeammateSchema,
  responses: {
    200: { description: "Hired teammate", schema: teammateResponseSchema },
  },
  handler: async ({ serviceContext, body }) => {
    return hireTeammate(serviceContext, body);
  },
});

addRoute(app, "post", "/:teammateId/feedback", {
  tags: ["teammates"],
  summary: "Say whether a teammate got it right",
  description:
    "One verdict per person per conversation, which builds the teammate's scorecard. Saying it again replaces the earlier verdict.",
  auth: true,
  paramSchema: teammateIdParamSchema,
  bodySchema: recordTeammateFeedbackSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, body }) => {
    await recordTeammateFeedback(serviceContext, params.teammateId, body);

    return { success: true };
  },
});

addRoute(app, "post", "/:teammateId/projects/:projectId/remove", {
  tags: ["teammates"],
  summary: "Remove a workspace teammate from one project",
  description:
    "Workspace defaults reach every project. This records that one project does not want this teammate, without removing it from the workspace.",
  auth: true,
  paramSchema: z.object({
    teammateId: z.string().min(1),
    projectId: z.string().min(1),
  }),
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    await removeInheritedTeammateFromProject(serviceContext, params.projectId, params.teammateId);

    return { success: true };
  },
});

addRoute(app, "post", "/:teammateId/projects/:projectId/restore", {
  tags: ["teammates"],
  summary: "Give a project back a workspace teammate it had removed",
  auth: true,
  paramSchema: z.object({
    teammateId: z.string().min(1),
    projectId: z.string().min(1),
  }),
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    await restoreInheritedTeammateToProject(serviceContext, params.projectId, params.teammateId);

    return { success: true };
  },
});

app.route("/shared", sharedTeammates);

addRoute(app, "get", "/:teammateId/contexts", {
  tags: ["teammates"],
  summary: "List scoped teammate contexts",
  auth: true,
  paramSchema: teammateIdParamSchema,
  responses: {
    200: { description: "Contexts", schema: teammateContextListResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    listTeammateContexts(serviceContext, params.teammateId),
});

addRoute(app, "post", "/:teammateId/contexts", {
  tags: ["teammates"],
  summary: "Create or find a scoped teammate context",
  auth: true,
  paramSchema: teammateIdParamSchema,
  bodySchema: ensureTeammateContextSchema,
  responses: { 200: { description: "Context", schema: teammateContextSchema } },
  handler: async ({ serviceContext, params, body }) =>
    ensureTeammateContext(serviceContext, params.teammateId, body.scope),
});

addRoute(app, "patch", "/contexts/:contextId", {
  tags: ["teammates"],
  summary: "Update a teammate context lifecycle",
  auth: true,
  paramSchema: z.object({ contextId: z.string().min(1) }),
  bodySchema: updateTeammateContextStatusSchema,
  responses: { 200: { description: "Context", schema: teammateContextSchema } },
  handler: async ({ serviceContext, params, body }) =>
    updateTeammateContextStatus(serviceContext, params.contextId, body.status),
});

addRoute(app, "get", "/contexts/:contextId/connections", {
  tags: ["teammates"],
  summary: "List a teammate context's connection grants",
  auth: true,
  paramSchema: z.object({ contextId: z.string().min(1) }),
  responses: {
    200: {
      description: "Connection grants",
      schema: teammateConnectionGrantListResponseSchema,
    },
  },
  handler: async ({ serviceContext, params }) =>
    listTeammateConnectionGrants(serviceContext, params.contextId),
});

addRoute(app, "put", "/contexts/:contextId/connections", {
  tags: ["teammates"],
  summary: "Grant exact connection operations to a teammate context",
  auth: true,
  paramSchema: z.object({ contextId: z.string().min(1) }),
  bodySchema: upsertTeammateConnectionGrantSchema,
  responses: {
    200: {
      description: "Connection grant",
      schema: teammateConnectionGrantSchema,
    },
  },
  handler: async ({ serviceContext, params, body }) =>
    upsertTeammateConnectionGrant(serviceContext, params.contextId, body),
});

const teammateContextIdParamSchema = z.object({ contextId: z.string().min(1) });

addRoute(app, "get", "/contexts/:contextId/memory", {
  tags: ["teammates"],
  summary: "Get a teammate context's private memory",
  auth: true,
  paramSchema: teammateContextIdParamSchema,
  responses: {
    200: { description: "Memory document", schema: memoryDocumentSchema },
  },
  handler: async ({ serviceContext, params }) =>
    getTeammateContextMemory(serviceContext, params.contextId),
});

addRoute(app, "put", "/contexts/:contextId/memory", {
  tags: ["teammates"],
  summary: "Save a teammate context memory revision",
  auth: true,
  paramSchema: teammateContextIdParamSchema,
  bodySchema: updateMemoryDocumentSchema.omit({ projectId: true }),
  responses: {
    200: { description: "Memory document", schema: memoryDocumentSchema },
  },
  handler: async ({ serviceContext, params, body }) =>
    updateTeammateContextMemory(serviceContext, params.contextId, body),
});

addRoute(app, "get", "/contexts/:contextId/computer", {
  tags: ["teammates"],
  summary: "Get a teammate context's hosted computer",
  auth: true,
  paramSchema: teammateContextIdParamSchema,
  responses: {
    200: { description: "Computer", schema: teammateComputerSchema },
  },
  handler: async ({ serviceContext, params }) =>
    getTeammateComputer(serviceContext, params.contextId),
});

addRoute(app, "post", "/contexts/:contextId/computer/actions", {
  tags: ["teammates"],
  summary: "Manage a teammate context's hosted computer",
  auth: true,
  paramSchema: teammateContextIdParamSchema,
  bodySchema: teammateComputerActionSchema,
  responses: {
    200: {
      description: "Computer action result",
      schema: teammateComputerActionResponseSchema,
    },
  },
  handler: async ({ serviceContext, params, body }) =>
    performTeammateComputerAction(serviceContext, params.contextId, body),
});

addRoute(app, "post", "/contexts/:contextId/computer/takeover", {
  tags: ["teammates"],
  summary: "Take temporary control of a teammate computer",
  auth: true,
  paramSchema: teammateContextIdParamSchema,
  bodySchema: teammateComputerTakeoverInputSchema,
  responses: {
    200: {
      description: "Screen connection",
      schema: teammateComputerTakeoverResponseSchema,
    },
  },
  handler: async ({ serviceContext, params, body }) =>
    takeOverTeammateComputer(serviceContext, params.contextId, body.recordTeaching),
});

addRoute(app, "post", "/contexts/:contextId/computer/release", {
  tags: ["teammates"],
  summary: "Release control of a teammate computer",
  auth: true,
  paramSchema: teammateContextIdParamSchema,
  bodySchema: z.object({ fence: z.number().int().positive() }),
  responses: {
    200: { description: "Computer", schema: teammateComputerSchema },
  },
  handler: async ({ serviceContext, params, body }) =>
    releaseTeammateComputer(serviceContext, params.contextId, body.fence),
});

addRoute(app, "get", "/:teammateId", {
  tags: ["teammates"],
  summary: "Get an teammate by ID",
  auth: true,
  paramSchema: teammateIdParamSchema,
  responses: {
    200: { description: "Teammate", schema: teammateResponseSchema },
  },
  handler: async ({ serviceContext, params }) => {
    return getTeammateById(serviceContext, params.teammateId);
  },
});

addRoute(app, "put", "/:teammateId", {
  tags: ["teammates"],
  summary: "Update an teammate",
  auth: true,
  paramSchema: teammateIdParamSchema,
  bodySchema: updateTeammateSchema,
  responses: {
    200: { description: "Updated teammate", schema: teammateResponseSchema },
  },
  handler: async ({ serviceContext, params, body }) => {
    return updateTeammate(serviceContext, params.teammateId, body);
  },
});

addRoute(app, "delete", "/:teammateId", {
  tags: ["teammates"],
  summary: "Delete an teammate",
  auth: true,
  paramSchema: teammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    await deleteTeammate(serviceContext, params.teammateId);

    return { message: "Teammate deleted successfully" };
  },
});

addRoute(app, "post", "/:teammateId/publish/workspace", {
  tags: ["teammates"],
  summary: "Publish an teammate to a workspace",
  description:
    "Copy a personal teammate into a workspace so the workspace owns it, keeping a link back to the source teammate",
  auth: true,
  paramSchema: teammateIdParamSchema,
  bodySchema: publishTeammateToWorkspaceSchema,
  responses: {
    200: { description: "Published teammate", schema: teammateResponseSchema },
  },
  handler: async ({ serviceContext, params, body }) => {
    return publishTeammateToWorkspace(serviceContext, params.teammateId, body.workspace_id);
  },
});

addRoute(app, "post", "/:teammateId/completions", {
  tags: ["teammates"],
  summary: "Create teammate completion",
  description: "Run a chat completion against a specific teammate",
  paramSchema: teammateIdParamSchema,
  bodySchema: createChatCompletionsJsonSchema,
  middleware: [validateCaptcha],
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, raw, params, body, user, anonymousUser }) => {
    if (!user && !anonymousUser) {
      return ResponseFactory.error(raw, "Unauthorized", 401);
    }

    const execute = body.options?.toolInteraction ? resumeTeammateRun : enqueueTeammateRun;
    const response = await execute({
      env: raw.env,
      context: serviceContext,
      body,
      teammateId: params.teammateId,
      user,
      anonymousUser,
      executionCtx: requireCloudflareExecutionContext(raw.executionCtx),
      signal: raw.req.raw.signal,
    });

    if (response instanceof Response) {
      return response;
    }

    return ResponseFactory.success(raw, response);
  },
});

export default app;
