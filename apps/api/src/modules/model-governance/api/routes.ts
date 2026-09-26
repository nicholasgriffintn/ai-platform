import {
  bomQuerySchema,
  budgetScopeQuerySchema,
  connectionCheckSchema,
  modelAuditQuerySchema,
  modelAuditResponseSchema,
  modelBudgetSchema,
  modelConnectionParamsSchema,
  modelConnectionSchema,
  modelInventoryResponseSchema,
  modelPermissionsSchema,
  modelSpendRequestParamsSchema,
  modelsOverviewSchema,
  myModelPermissionsSchema,
  providerCatalogueResponseSchema,
  registryProjectScopeQuerySchema,
  registryVersionParamsSchema,
  registryWorkspaceParamsSchema,
  resolveSpendRequestSchema,
  revocationResultSchema,
  revokeVersionRequestSchema,
  saveBudgetRequestSchema,
  saveModelConnectionRequestSchema,
  saveModelPermissionsRequestSchema,
  spendRequestSchema,
  spendRequestsResponseSchema,
  spendSummarySchema,
  trainingContentSummarySchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { listModelAudit } from "~/modules/model-governance/application/audit";
import {
  checkModelConnection,
  deleteModelConnection,
  listProviderCatalogue,
  saveModelConnection,
} from "~/modules/model-governance/application/connections";
import {
  exportBom,
  exportInventory,
  exportModelCard,
  exportTrainingContentSummary,
} from "~/modules/model-governance/application/exports";
import { getModelsOverview } from "~/modules/model-governance/application/overview";
import {
  getModelPermissions,
  getMyModelPermissions,
  saveModelPermissions,
} from "~/modules/model-governance/application/permissions";
import { revokeVersion } from "~/modules/model-governance/application/revocation";
import {
  deleteBudget,
  getSpendSummary,
  saveBudget,
} from "~/modules/model-governance/application/spend";
import { resolveSpendRequest } from "~/modules/model-governance/application/spend-execution";
import { listSpendRequests } from "~/modules/model-governance/application/spend-requests";

const app = new Hono();
const tags = ["model-governance"];
const base = "/workspaces/:workspaceId";

addRoute(app, "get", `${base}/overview`, {
  auth: true,
  tags,
  summary: "Aliases, deployments, runs, pending decisions and spend at a glance",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Overview", schema: modelsOverviewSchema } },
  handler: ({ serviceContext, params, query }) =>
    getModelsOverview(serviceContext, params.workspaceId, query.projectId),
});

addRoute(app, "get", `${base}/providers`, {
  auth: true,
  tags,
  summary: "List providers with their trainers, hosts, hardware and connection state",
  paramSchema: registryWorkspaceParamsSchema,
  responses: {
    200: { description: "Provider catalogue", schema: providerCatalogueResponseSchema },
  },
  handler: ({ serviceContext, params }) =>
    listProviderCatalogue(serviceContext, params.workspaceId),
});

addRoute(app, "post", `${base}/providers/:provider/check`, {
  auth: true,
  tags,
  summary: "Check provider credentials before saving them",
  paramSchema: modelConnectionParamsSchema,
  bodySchema: saveModelConnectionRequestSchema,
  responses: { 200: { description: "Check result", schema: connectionCheckSchema } },
  handler: ({ serviceContext, params, body }) =>
    checkModelConnection(serviceContext, params.workspaceId, params.provider, body),
});

addRoute(app, "put", `${base}/providers/:provider`, {
  auth: true,
  tags,
  summary: "Connect this workspace to a provider account",
  paramSchema: modelConnectionParamsSchema,
  bodySchema: saveModelConnectionRequestSchema,
  responses: { 200: { description: "Connection", schema: modelConnectionSchema } },
  handler: ({ serviceContext, params, body }) =>
    saveModelConnection(serviceContext, params.workspaceId, params.provider, body),
});

addRoute(app, "delete", `${base}/providers/:provider`, {
  auth: true,
  tags,
  summary: "Disconnect a provider account",
  paramSchema: modelConnectionParamsSchema,
  responses: { 200: { description: "Deleted", schema: z.object({ deleted: z.boolean() }) } },
  handler: ({ serviceContext, params }) =>
    deleteModelConnection(serviceContext, params.workspaceId, params.provider),
});

addRoute(app, "get", `${base}/permissions`, {
  auth: true,
  tags,
  summary: "Get which roles may take each model action",
  paramSchema: registryWorkspaceParamsSchema,
  responses: { 200: { description: "Permissions", schema: modelPermissionsSchema } },
  handler: ({ serviceContext, params }) => getModelPermissions(serviceContext, params.workspaceId),
});

addRoute(app, "get", `${base}/permissions/me`, {
  auth: true,
  tags,
  summary: "Get the model actions available to the current member",
  paramSchema: registryWorkspaceParamsSchema,
  responses: { 200: { description: "Permissions", schema: myModelPermissionsSchema } },
  handler: ({ serviceContext, params }) =>
    getMyModelPermissions(serviceContext, params.workspaceId),
});

addRoute(app, "put", `${base}/permissions`, {
  auth: true,
  tags,
  summary: "Save role grants and separation of duties",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: saveModelPermissionsRequestSchema,
  responses: { 200: { description: "Permissions", schema: modelPermissionsSchema } },
  handler: ({ serviceContext, params, body }) =>
    saveModelPermissions(serviceContext, params.workspaceId, body),
});

addRoute(app, "get", `${base}/spend`, {
  auth: true,
  tags,
  summary: "Month-to-date spend, commitments and budgets",
  paramSchema: registryWorkspaceParamsSchema,
  responses: { 200: { description: "Spend", schema: spendSummarySchema } },
  handler: ({ serviceContext, params }) => getSpendSummary(serviceContext, params.workspaceId),
});

addRoute(app, "put", `${base}/budgets`, {
  auth: true,
  tags,
  summary: "Save the workspace or a project budget",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: saveBudgetRequestSchema,
  responses: { 200: { description: "Budget", schema: modelBudgetSchema } },
  handler: ({ serviceContext, params, body }) =>
    saveBudget(serviceContext, params.workspaceId, body),
});

addRoute(app, "delete", `${base}/budgets`, {
  auth: true,
  tags,
  summary: "Remove the workspace or a project budget",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: budgetScopeQuerySchema,
  responses: { 200: { description: "Deleted", schema: z.object({ deleted: z.literal(true) }) } },
  handler: ({ serviceContext, params, query }) =>
    deleteBudget(serviceContext, params.workspaceId, query.projectId ?? null),
});

addRoute(app, "get", `${base}/spend-requests`, {
  auth: true,
  tags,
  summary: "List spend requests awaiting or past approval",
  paramSchema: registryWorkspaceParamsSchema,
  responses: { 200: { description: "Requests", schema: spendRequestsResponseSchema } },
  handler: ({ serviceContext, params }) => listSpendRequests(serviceContext, params.workspaceId),
});

addRoute(app, "post", `${base}/spend-requests/:requestId/resolve`, {
  auth: true,
  tags,
  summary: "Approve and start, or reject, a spend request",
  paramSchema: modelSpendRequestParamsSchema,
  bodySchema: resolveSpendRequestSchema,
  responses: { 200: { description: "Request", schema: spendRequestSchema } },
  handler: ({ serviceContext, params, body }) =>
    resolveSpendRequest(serviceContext, params.workspaceId, params.requestId, body),
});

addRoute(app, "get", `${base}/audit`, {
  auth: true,
  tags,
  summary: "Model platform audit trail",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: modelAuditQuerySchema,
  responses: { 200: { description: "Audit events", schema: modelAuditResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listModelAudit(serviceContext, params.workspaceId, query),
});

addRoute(app, "get", `${base}/inventory`, {
  auth: true,
  tags,
  summary: "Export the AI system inventory",
  paramSchema: registryWorkspaceParamsSchema,
  responses: { 200: { description: "Inventory", schema: modelInventoryResponseSchema } },
  handler: ({ serviceContext, params }) => exportInventory(serviceContext, params.workspaceId),
});

addRoute(app, "post", `${base}/versions/:versionId/revoke`, {
  auth: true,
  tags,
  summary: "Revoke a version and everything derived from it",
  description: "Revokes approvals, retires routes, pauses deployments and clears aliases.",
  paramSchema: registryVersionParamsSchema,
  bodySchema: revokeVersionRequestSchema,
  responses: { 200: { description: "Revocation", schema: revocationResultSchema } },
  handler: ({ serviceContext, params, body }) =>
    revokeVersion(serviceContext, params.workspaceId, params.versionId, body),
});

addRoute(app, "get", `${base}/versions/:versionId/bom`, {
  auth: true,
  tags,
  summary: "Export a CycloneDX or SPDX AI bill of materials",
  paramSchema: registryVersionParamsSchema,
  querySchema: bomQuerySchema,
  responses: { 200: { description: "BOM document", schema: z.record(z.string(), z.unknown()) } },
  handler: ({ serviceContext, params, query }) =>
    exportBom(serviceContext, params.workspaceId, params.versionId, query.format, query.routeId),
});

addRoute(app, "get", `${base}/versions/:versionId/card`, {
  auth: true,
  tags,
  summary: "Render a model card",
  paramSchema: registryVersionParamsSchema,
  responses: { 200: { description: "Model card", schema: z.object({ markdown: z.string() }) } },
  handler: ({ serviceContext, params }) =>
    exportModelCard(serviceContext, params.workspaceId, params.versionId),
});

addRoute(app, "get", `${base}/versions/:versionId/training-content`, {
  auth: true,
  tags,
  summary: "Summarise training content for a modified model",
  paramSchema: registryVersionParamsSchema,
  responses: { 200: { description: "Summary", schema: trainingContentSummarySchema } },
  handler: ({ serviceContext, params }) =>
    exportTrainingContentSummary(serviceContext, params.workspaceId, params.versionId),
});

export default app;
