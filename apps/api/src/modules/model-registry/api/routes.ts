import {
  bomQuerySchema,
  buildsResponseSchema,
  deployVersionRequestSchema,
  huggingFaceConnectionSchema,
  huggingFaceTokenCheckRequestSchema,
  huggingFaceTokenCheckSchema,
  modelBuildSchema,
  saveHuggingFaceConnectionRequestSchema,
  startBuildRequestSchema,
  createEvalSuiteRequestSchema,
  createRouteRequestSchema,
  decisionListQuerySchema,
  decisionsResponseSchema,
  evalCaseResultsResponseSchema,
  evalRunsResponseSchema,
  evalSuiteSchema,
  evalSuitesResponseSchema,
  importAssetRequestSchema,
  libraryQuerySchema,
  libraryResponseSchema,
  modelDecisionSchema,
  modelPolicySchema,
  modelRouteSchema,
  policiesResponseSchema,
  policyDryRunRequestSchema,
  policyDryRunResultSchema,
  registryDecisionParamsSchema,
  registryProjectScopeQuerySchema,
  registryRouteParamsSchema,
  registryRunParamsSchema,
  registrySuiteParamsSchema,
  registryVersionParamsSchema,
  registryWorkspaceParamsSchema,
  requestDecisionSchema,
  resolveDecisionSchema,
  routeHealthSchema,
  routeSuggestionsResponseSchema,
  routesResponseSchema,
  sourceSearchQuerySchema,
  sourceSearchResponseSchema,
  startEvalRunsRequestSchema,
  upsertPolicyRequestSchema,
  versionDetailSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { exportMlBom } from "~/modules/model-registry/application/bom";
import { listBuilds, startBuild } from "~/modules/model-registry/application/builds";
import {
  checkHuggingFaceToken,
  deleteHuggingFaceConnection,
  getHuggingFaceConnection,
  saveHuggingFaceConnection,
} from "~/modules/model-registry/application/credentials";
import {
  listDecisions,
  requestDecision,
  resolveDecision,
} from "~/modules/model-registry/application/decisions";
import { deployVersion } from "~/modules/model-registry/application/deploy";
import {
  createEvalSuite,
  deleteEvalSuite,
  listEvalRuns,
  listEvalSuites,
  readEvalCaseResults,
  startEvalRuns,
} from "~/modules/model-registry/application/evals";
import { getRouteHealth } from "~/modules/model-registry/application/health";
import { importAsset, reinspectVersion } from "~/modules/model-registry/application/importing";
import { getVersionDetail, listLibrary } from "~/modules/model-registry/application/library";
import {
  dryRunPolicy,
  getPolicies,
  upsertPolicy,
} from "~/modules/model-registry/application/policies";
import {
  createRoute,
  listRoutes,
  retireRoute,
  suggestRoutes,
} from "~/modules/model-registry/application/serving";
import { searchSources } from "~/modules/model-registry/application/sources";

const app = new Hono();
const tags = ["model-registry"];
const base = "/workspaces/:workspaceId";

addRoute(app, "get", `${base}/sources`, {
  auth: true,
  tags,
  summary: "Search model and dataset sources",
  description:
    "Searches Hugging Face and previews the workspace policy from metadata alone, without downloading anything.",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: sourceSearchQuerySchema,
  responses: { 200: { description: "Search results", schema: sourceSearchResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    searchSources(serviceContext, params.workspaceId, query),
});

addRoute(app, "get", `${base}/library`, {
  auth: true,
  tags,
  summary: "List imported models and datasets with their standing",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: libraryQuerySchema,
  responses: { 200: { description: "Library entries", schema: libraryResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listLibrary(serviceContext, params.workspaceId, query),
});

addRoute(app, "post", `${base}/imports`, {
  auth: true,
  tags,
  summary: "Import a pinned model or dataset version",
  description:
    "Resolves the revision to a commit, records file hashes and queues static inspection.",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: importAssetRequestSchema,
  responses: { 200: { description: "Imported version", schema: versionDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    importAsset(serviceContext, params.workspaceId, body),
});

addRoute(app, "get", `${base}/versions/:versionId`, {
  auth: true,
  tags,
  summary: "Get a version with its evidence, decisions, routes, lineage and evals",
  paramSchema: registryVersionParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Version detail", schema: versionDetailSchema } },
  handler: ({ serviceContext, params, query }) =>
    getVersionDetail(serviceContext, params.workspaceId, params.versionId, query.projectId),
});

addRoute(app, "post", `${base}/versions/:versionId/reinspect`, {
  auth: true,
  tags,
  summary: "Queue a fresh static inspection",
  paramSchema: registryVersionParamsSchema,
  responses: { 200: { description: "Version detail", schema: versionDetailSchema } },
  handler: ({ serviceContext, params }) =>
    reinspectVersion(serviceContext, params.workspaceId, params.versionId),
});

addRoute(app, "get", `${base}/versions/:versionId/bom`, {
  auth: true,
  tags,
  summary: "Export a CycloneDX ML-BOM for a version or one of its routes",
  paramSchema: registryVersionParamsSchema,
  querySchema: bomQuerySchema,
  responses: {
    200: { description: "CycloneDX document", schema: z.record(z.string(), z.unknown()) },
  },
  handler: ({ serviceContext, params, query }) =>
    exportMlBom(serviceContext, params.workspaceId, params.versionId, query.routeId),
});

addRoute(app, "get", `${base}/versions/:versionId/route-suggestions`, {
  auth: true,
  tags,
  summary: "List providers in the catalogue that already serve this model",
  paramSchema: registryVersionParamsSchema,
  responses: { 200: { description: "Route suggestions", schema: routeSuggestionsResponseSchema } },
  handler: ({ serviceContext, params }) =>
    suggestRoutes(serviceContext, params.workspaceId, params.versionId),
});

addRoute(app, "get", `${base}/policies`, {
  auth: true,
  tags,
  summary: "Get the workspace policy and any project policies",
  paramSchema: registryWorkspaceParamsSchema,
  responses: { 200: { description: "Policies", schema: policiesResponseSchema } },
  handler: ({ serviceContext, params }) => getPolicies(serviceContext, params.workspaceId),
});

addRoute(app, "put", `${base}/policies`, {
  auth: true,
  tags,
  summary: "Save a new revision of the workspace or a project policy",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: upsertPolicyRequestSchema,
  responses: { 200: { description: "Saved policy", schema: modelPolicySchema } },
  handler: ({ serviceContext, params, body }) =>
    upsertPolicy(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", `${base}/policies/dry-run`, {
  auth: true,
  tags,
  summary: "Preview which verdicts change under proposed rules",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: policyDryRunRequestSchema,
  responses: { 200: { description: "Verdict changes", schema: policyDryRunResultSchema } },
  handler: ({ serviceContext, params, body }) =>
    dryRunPolicy(serviceContext, params.workspaceId, body),
});

addRoute(app, "get", `${base}/decisions`, {
  auth: true,
  tags,
  summary: "List approval decisions",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: decisionListQuerySchema,
  responses: { 200: { description: "Decisions", schema: decisionsResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listDecisions(serviceContext, params.workspaceId, query),
});

addRoute(app, "post", `${base}/decisions`, {
  auth: true,
  tags,
  summary: "Request approval or an exception for a version or route",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: requestDecisionSchema,
  responses: { 200: { description: "Decision", schema: modelDecisionSchema } },
  handler: ({ serviceContext, params, body }) =>
    requestDecision(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", `${base}/decisions/:decisionId/resolve`, {
  auth: true,
  tags,
  summary: "Approve, reject or revoke a decision",
  paramSchema: registryDecisionParamsSchema,
  bodySchema: resolveDecisionSchema,
  responses: { 200: { description: "Decision", schema: modelDecisionSchema } },
  handler: ({ serviceContext, params, body }) =>
    resolveDecision(serviceContext, params.workspaceId, params.decisionId, body),
});

addRoute(app, "get", `${base}/routes`, {
  auth: true,
  tags,
  summary: "List serving routes and whether each is approved in scope",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Routes", schema: routesResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listRoutes(serviceContext, params.workspaceId, query.projectId),
});

addRoute(app, "post", `${base}/routes`, {
  auth: true,
  tags,
  summary: "Register a serving route for a version",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: createRouteRequestSchema,
  responses: { 200: { description: "Route", schema: modelRouteSchema } },
  handler: ({ serviceContext, params, body }) =>
    createRoute(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", `${base}/routes/:routeId/retire`, {
  auth: true,
  tags,
  summary: "Retire a serving route",
  paramSchema: registryRouteParamsSchema,
  responses: { 200: { description: "Route", schema: modelRouteSchema } },
  handler: ({ serviceContext, params }) =>
    retireRoute(serviceContext, params.workspaceId, params.routeId),
});

addRoute(app, "get", `${base}/routes/:routeId/health`, {
  auth: true,
  tags,
  summary: "Usage, latency, spend and replay trend for a route",
  paramSchema: registryRouteParamsSchema,
  responses: { 200: { description: "Route health", schema: routeHealthSchema } },
  handler: ({ serviceContext, params }) =>
    getRouteHealth(serviceContext, params.workspaceId, params.routeId),
});

addRoute(app, "get", `${base}/eval-suites`, {
  auth: true,
  tags,
  summary: "List eval suites",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Suites", schema: evalSuitesResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listEvalSuites(serviceContext, params.workspaceId, query.projectId),
});

addRoute(app, "post", `${base}/eval-suites`, {
  auth: true,
  tags,
  summary: "Create an eval suite",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: createEvalSuiteRequestSchema,
  responses: { 200: { description: "Suite", schema: evalSuiteSchema } },
  handler: ({ serviceContext, params, body }) =>
    createEvalSuite(serviceContext, params.workspaceId, body),
});

addRoute(app, "delete", `${base}/eval-suites/:suiteId`, {
  auth: true,
  tags,
  summary: "Delete an eval suite",
  paramSchema: registrySuiteParamsSchema,
  responses: {
    200: { description: "Deleted", schema: z.object({ deleted: z.literal(true) }) },
  },
  handler: ({ serviceContext, params }) =>
    deleteEvalSuite(serviceContext, params.workspaceId, params.suiteId),
});

addRoute(app, "post", `${base}/eval-suites/:suiteId/runs`, {
  auth: true,
  tags,
  summary: "Run a suite against up to six routes",
  paramSchema: registrySuiteParamsSchema,
  bodySchema: startEvalRunsRequestSchema,
  responses: { 200: { description: "Queued runs", schema: evalRunsResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    startEvalRuns(serviceContext, params.workspaceId, params.suiteId, body),
});

addRoute(app, "get", `${base}/eval-suites/:suiteId/runs`, {
  auth: true,
  tags,
  summary: "List runs for a suite",
  paramSchema: registrySuiteParamsSchema,
  responses: { 200: { description: "Runs", schema: evalRunsResponseSchema } },
  handler: ({ serviceContext, params }) =>
    listEvalRuns(serviceContext, params.workspaceId, params.suiteId),
});

addRoute(app, "get", `${base}/eval-runs/:runId/results`, {
  auth: true,
  tags,
  summary: "Per-case outputs and scores for a run",
  paramSchema: registryRunParamsSchema,
  responses: { 200: { description: "Case results", schema: evalCaseResultsResponseSchema } },
  handler: ({ serviceContext, params }) =>
    readEvalCaseResults(serviceContext, params.workspaceId, params.runId),
});

addRoute(app, "get", `${base}/builds`, {
  auth: true,
  tags,
  summary: "List fine-tunes and their lineage",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Builds", schema: buildsResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listBuilds(serviceContext, params.workspaceId, query.projectId),
});

addRoute(app, "post", `${base}/builds`, {
  auth: true,
  tags,
  summary: "Fine-tune an approved base on a governed snapshot of rated conversations",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: startBuildRequestSchema,
  responses: { 200: { description: "Build", schema: modelBuildSchema } },
  handler: ({ serviceContext, params, body }) =>
    startBuild(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", `${base}/versions/:versionId/deploy`, {
  auth: true,
  tags,
  summary: "Serve an approved version on a dedicated Inference Endpoint",
  paramSchema: registryVersionParamsSchema,
  bodySchema: deployVersionRequestSchema,
  responses: { 200: { description: "Route", schema: modelRouteSchema } },
  handler: ({ serviceContext, params, body }) =>
    deployVersion(serviceContext, params.workspaceId, params.versionId, body),
});

const huggingFace = `${base}/connections/huggingface`;
const connectionResponses = {
  200: { description: "Hugging Face connection", schema: huggingFaceConnectionSchema },
};

addRoute(app, "get", huggingFace, {
  auth: true,
  tags,
  summary: "Show how this workspace reaches Hugging Face",
  paramSchema: registryWorkspaceParamsSchema,
  responses: connectionResponses,
  handler: ({ serviceContext, params }) =>
    getHuggingFaceConnection(serviceContext, params.workspaceId),
});

addRoute(app, "post", `${huggingFace}/check`, {
  auth: true,
  tags,
  summary: "Check a Hugging Face token before saving it",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: huggingFaceTokenCheckRequestSchema,
  responses: { 200: { description: "Token identity", schema: huggingFaceTokenCheckSchema } },
  handler: ({ serviceContext, params, body }) =>
    checkHuggingFaceToken(serviceContext, params.workspaceId, body.token),
});

addRoute(app, "put", huggingFace, {
  auth: true,
  tags,
  summary: "Connect this workspace to a Hugging Face account or organisation",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: saveHuggingFaceConnectionRequestSchema,
  responses: connectionResponses,
  handler: ({ serviceContext, params, body }) =>
    saveHuggingFaceConnection(serviceContext, params.workspaceId, body),
});

addRoute(app, "delete", huggingFace, {
  auth: true,
  tags,
  summary: "Disconnect this workspace from Hugging Face",
  paramSchema: registryWorkspaceParamsSchema,
  responses: connectionResponses,
  handler: ({ serviceContext, params }) =>
    deleteHuggingFaceConnection(serviceContext, params.workspaceId),
});

export default app;
