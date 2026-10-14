import {
  aliasDetailSchema,
  aliasesResponseSchema,
  createAliasRequestSchema,
  createDeploymentRequestSchema,
  createRouteRequestSchema,
  deploymentDetailSchema,
  deploymentPlanRequestSchema,
  deploymentPlanSchema,
  deploymentStartResultSchema,
  deploymentsResponseSchema,
  modelAliasParamsSchema,
  modelAliasSchema,
  deploymentActionRequestSchema,
  modelDeploymentParamsSchema,
  modelDeploymentSchema,
  modelRouteSchema,
  playgroundRequestSchema,
  playgroundResponseSchema,
  promoteAliasRequestSchema,
  promotionResultSchema,
  registryProjectScopeQuerySchema,
  registryRouteParamsSchema,
  registryVersionParamsSchema,
  registryWorkspaceParamsSchema,
  routeHealthSchema,
  routeSuggestionsResponseSchema,
  routesResponseSchema,
  scaleDeploymentRequestSchema,
  updateAliasRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  createAlias,
  deleteAlias,
  getAliasDetail,
  listAliases,
  promoteAlias,
  rollbackAlias,
  updateAlias,
} from "~/modules/model-serving/application/aliases";
import {
  changeDeploymentState,
  createDeployment,
  getDeploymentDetail,
  listDeployments,
  runPlayground,
  scaleDeployment,
} from "~/modules/model-serving/application/deployments";
import { getRouteHealth } from "~/modules/model-serving/application/health";
import { planDeployment } from "~/modules/model-serving/application/plan";
import {
  createRoute,
  listRoutes,
  retireRoute,
  suggestRoutes,
} from "~/modules/model-serving/application/routes";

const app = new Hono();
const tags = ["model-serving"];
const base = "/workspaces/:workspace_id";

addRoute(app, "post", `${base}/deployments/plan`, {
  auth: true,
  tags,
  summary: "Size a model and compare every connected host that can serve it",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: deploymentPlanRequestSchema,
  responses: { 200: { description: "Plan", schema: deploymentPlanSchema } },
  handler: ({ serviceContext, params, body }) =>
    planDeployment(serviceContext, params.workspace_id, body),
});

addRoute(app, "get", `${base}/deployments`, {
  auth: true,
  tags,
  summary: "List deployments",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Deployments", schema: deploymentsResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listDeployments(serviceContext, params.workspace_id, query.project_id),
});

addRoute(app, "post", `${base}/deployments`, {
  auth: true,
  tags,
  summary: "Deploy a governed version, or file a spend request when the budget needs approval",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: createDeploymentRequestSchema,
  responses: { 200: { description: "Start result", schema: deploymentStartResultSchema } },
  handler: ({ serviceContext, params, body }) =>
    createDeployment(serviceContext, params.workspace_id, body),
});

addRoute(app, "get", `${base}/deployments/:deployment_id`, {
  auth: true,
  tags,
  summary: "Get a deployment with its route, aliases, usage and spend",
  paramSchema: modelDeploymentParamsSchema,
  responses: { 200: { description: "Deployment", schema: deploymentDetailSchema } },
  handler: ({ serviceContext, params }) =>
    getDeploymentDetail(serviceContext, params.workspace_id, params.deployment_id),
});

addRoute(app, "post", `${base}/deployments/:deployment_id/scale`, {
  auth: true,
  tags,
  summary: "Change replica bounds and scale-to-zero",
  paramSchema: modelDeploymentParamsSchema,
  bodySchema: scaleDeploymentRequestSchema,
  responses: { 200: { description: "Deployment", schema: modelDeploymentSchema } },
  handler: ({ serviceContext, params, body }) =>
    scaleDeployment(serviceContext, params.workspace_id, params.deployment_id, body),
});

addRoute(app, "post", `${base}/deployments/:deployment_id/playground`, {
  auth: true,
  tags,
  summary: "Send a test conversation to a deployment",
  paramSchema: modelDeploymentParamsSchema,
  bodySchema: playgroundRequestSchema,
  responses: { 200: { description: "Completion", schema: playgroundResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    runPlayground(serviceContext, params.workspace_id, params.deployment_id, body),
});

addRoute(app, "post", `${base}/deployments/:deployment_id/actions`, {
  auth: true,
  tags,
  summary: "Pause, resume or delete a deployment",
  paramSchema: modelDeploymentParamsSchema,
  bodySchema: deploymentActionRequestSchema,
  responses: { 200: { description: "Deployment", schema: modelDeploymentSchema } },
  handler: ({ serviceContext, params, body }) =>
    changeDeploymentState(serviceContext, params.workspace_id, params.deployment_id, body.action),
});

addRoute(app, "get", `${base}/aliases`, {
  auth: true,
  tags,
  summary: "List stable aliases that chat and apps call",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Aliases", schema: aliasesResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listAliases(serviceContext, params.workspace_id, query.project_id),
});

addRoute(app, "post", `${base}/aliases`, {
  auth: true,
  tags,
  summary: "Create an alias",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: createAliasRequestSchema,
  responses: { 200: { description: "Alias", schema: modelAliasSchema } },
  handler: ({ serviceContext, params, body }) =>
    createAlias(serviceContext, params.workspace_id, body),
});

addRoute(app, "get", `${base}/aliases/:alias_id`, {
  auth: true,
  tags,
  summary: "Get an alias with its history",
  paramSchema: modelAliasParamsSchema,
  responses: { 200: { description: "Alias", schema: aliasDetailSchema } },
  handler: ({ serviceContext, params }) =>
    getAliasDetail(serviceContext, params.workspace_id, params.alias_id),
});

addRoute(app, "patch", `${base}/aliases/:alias_id`, {
  auth: true,
  tags,
  summary: "Update an alias gate, canary or description",
  paramSchema: modelAliasParamsSchema,
  bodySchema: updateAliasRequestSchema,
  responses: { 200: { description: "Alias", schema: modelAliasSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateAlias(serviceContext, params.workspace_id, params.alias_id, body),
});

addRoute(app, "delete", `${base}/aliases/:alias_id`, {
  auth: true,
  tags,
  summary: "Delete an alias",
  paramSchema: modelAliasParamsSchema,
  responses: { 200: { description: "Deleted", schema: z.object({ deleted: z.literal(true) }) } },
  handler: ({ serviceContext, params }) =>
    deleteAlias(serviceContext, params.workspace_id, params.alias_id),
});

addRoute(app, "post", `${base}/aliases/:alias_id/promote`, {
  auth: true,
  tags,
  summary: "Promote a route behind an alias through its evaluation gate",
  paramSchema: modelAliasParamsSchema,
  bodySchema: promoteAliasRequestSchema,
  responses: { 200: { description: "Promotion", schema: promotionResultSchema } },
  handler: ({ serviceContext, params, body }) =>
    promoteAlias(serviceContext, params.workspace_id, params.alias_id, body),
});

addRoute(app, "post", `${base}/aliases/:alias_id/rollback`, {
  auth: true,
  tags,
  summary: "Point an alias back at its previous route",
  paramSchema: modelAliasParamsSchema,
  responses: { 200: { description: "Alias", schema: modelAliasSchema } },
  handler: ({ serviceContext, params }) =>
    rollbackAlias(serviceContext, params.workspace_id, params.alias_id),
});

addRoute(app, "get", `${base}/routes`, {
  auth: true,
  tags,
  summary: "List serving routes and whether each is approved in scope",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Routes", schema: routesResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listRoutes(serviceContext, params.workspace_id, query.project_id),
});

addRoute(app, "post", `${base}/routes`, {
  auth: true,
  tags,
  summary: "Register a serverless provider route for a version",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: createRouteRequestSchema,
  responses: { 200: { description: "Route", schema: modelRouteSchema } },
  handler: ({ serviceContext, params, body }) =>
    createRoute(serviceContext, params.workspace_id, body),
});

addRoute(app, "post", `${base}/routes/:route_id/retire`, {
  auth: true,
  tags,
  summary: "Retire a serving route",
  paramSchema: registryRouteParamsSchema,
  responses: { 200: { description: "Route", schema: modelRouteSchema } },
  handler: ({ serviceContext, params }) =>
    retireRoute(serviceContext, params.workspace_id, params.route_id),
});

addRoute(app, "get", `${base}/routes/:route_id/health`, {
  auth: true,
  tags,
  summary: "Usage, spend and replay trend for a route",
  paramSchema: registryRouteParamsSchema,
  responses: { 200: { description: "Route health", schema: routeHealthSchema } },
  handler: ({ serviceContext, params }) =>
    getRouteHealth(serviceContext, params.workspace_id, params.route_id),
});

addRoute(app, "get", `${base}/versions/:version_id/route_suggestions`, {
  auth: true,
  tags,
  summary: "List catalogue providers that already serve this model",
  paramSchema: registryVersionParamsSchema,
  responses: { 200: { description: "Route suggestions", schema: routeSuggestionsResponseSchema } },
  handler: ({ serviceContext, params }) =>
    suggestRoutes(serviceContext, params.workspace_id, params.version_id),
});

export default app;
