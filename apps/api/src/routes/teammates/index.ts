import {
  teammateListResponseSchema,
  teammateResponseSchema,
  createTeammateSchema,
  hireTeammateSchema,
  updateTeammateSchema,
  createChatCompletionsJsonSchema,
  publishTeammateToWorkspaceSchema,
  apiResponseSchema,
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
  updateTeammate,
  deleteTeammate,
  getTeammateServers,
  createTeammateCompletion,
  publishTeammateToWorkspace,
} from "~/services/teammates";
import type { IEnv } from "~/types";

import sharedAgents from "./shared";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("agents");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing agents route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

const teammateIdParamSchema = z.object({ teammateId: z.string().min(1) });

addRoute(app, "get", "/", {
  tags: ["agents"],
  summary: "Get all agents",
  description: "Get all agents for the current user",
  auth: true,
  responses: { 200: { description: "Agents", schema: teammateListResponseSchema } },
  handler: async ({ serviceContext }) => {
    return getUserTeammates(serviceContext);
  },
});

addRoute(app, "post", "/", {
  tags: ["agents"],
  summary: "Create an agent",
  description: "Create an agent for the current user",
  auth: true,
  bodySchema: createTeammateSchema,
  responses: { 200: { description: "Created agent", schema: teammateResponseSchema } },
  handler: async ({ serviceContext, body }) => {
    return createTeammate(serviceContext, body);
  },
});

addRoute(app, "post", "/hire", {
  tags: ["agents"],
  summary: "Hire a teammate",
  description:
    "Create a teammate from a built-in role, a job description, or both. The role supplies the brief, suggested tools and kind.",
  auth: true,
  bodySchema: hireTeammateSchema,
  responses: { 200: { description: "Hired teammate", schema: teammateResponseSchema } },
  handler: async ({ serviceContext, body }) => {
    return hireTeammate(serviceContext, body);
  },
});

app.route("/shared", sharedAgents);

addRoute(app, "get", "/:teammateId", {
  tags: ["agents"],
  summary: "Get an agent by ID",
  auth: true,
  paramSchema: teammateIdParamSchema,
  responses: { 200: { description: "Agent", schema: teammateResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    return getTeammateById(serviceContext, params.teammateId);
  },
});

addRoute(app, "get", "/:teammateId/servers", {
  tags: ["agents"],
  summary: "Get servers for an agent",
  auth: true,
  paramSchema: teammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    return getTeammateServers(serviceContext, params.teammateId);
  },
});

addRoute(app, "put", "/:teammateId", {
  tags: ["agents"],
  summary: "Update an agent",
  auth: true,
  paramSchema: teammateIdParamSchema,
  bodySchema: updateTeammateSchema,
  responses: { 200: { description: "Updated agent", schema: teammateResponseSchema } },
  handler: async ({ serviceContext, params, body }) => {
    return updateTeammate(serviceContext, params.teammateId, body);
  },
});

addRoute(app, "delete", "/:teammateId", {
  tags: ["agents"],
  summary: "Delete an agent",
  auth: true,
  paramSchema: teammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    await deleteTeammate(serviceContext, params.teammateId);

    return { message: "Agent deleted successfully" };
  },
});

addRoute(app, "post", "/:teammateId/publish/workspace", {
  tags: ["agents"],
  summary: "Publish an agent to a workspace",
  description:
    "Copy a personal agent into a workspace so the workspace owns it, keeping a link back to the source agent",
  auth: true,
  paramSchema: teammateIdParamSchema,
  bodySchema: publishTeammateToWorkspaceSchema,
  responses: { 200: { description: "Published agent", schema: teammateResponseSchema } },
  handler: async ({ serviceContext, params, body }) => {
    return publishTeammateToWorkspace(serviceContext, params.teammateId, body.workspace_id);
  },
});

addRoute(app, "post", "/:teammateId/completions", {
  tags: ["agents"],
  summary: "Create teammate completion",
  description: "Run a chat completion against a specific agent",
  paramSchema: teammateIdParamSchema,
  bodySchema: createChatCompletionsJsonSchema,
  middleware: [validateCaptcha],
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, raw, params, body, user, anonymousUser }) => {
    if (!user && !anonymousUser) {
      return ResponseFactory.error(raw, "Unauthorized", 401);
    }

    const response = await createTeammateCompletion({
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
