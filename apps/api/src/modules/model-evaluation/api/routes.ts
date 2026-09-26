import {
  createEvalSuiteRequestSchema,
  createGraderRequestSchema,
  evalCaseResultsResponseSchema,
  evalRunsResponseSchema,
  evalSuiteSchema,
  evalSuitesResponseSchema,
  graderPreviewRequestSchema,
  graderPreviewSchema,
  graderSchema,
  gradersResponseSchema,
  modelGraderParamsSchema,
  registryProjectScopeQuerySchema,
  registryRunParamsSchema,
  registrySuiteParamsSchema,
  registryWorkspaceParamsSchema,
  startEvalRunsRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  createGrader,
  deleteGrader,
  listGraders,
  previewGrader,
  updateGrader,
} from "~/modules/model-evaluation/application/graders";
import {
  createEvalSuite,
  deleteEvalSuite,
  listEvalRuns,
  listEvalSuites,
  readEvalCaseResults,
  startEvalRuns,
} from "~/modules/model-evaluation/application/suites";

const app = new Hono();
const tags = ["model-evaluation"];
const base = "/workspaces/:workspaceId";
const deleted = { 200: { description: "Deleted", schema: z.object({ deleted: z.literal(true) }) } };

addRoute(app, "get", `${base}/graders`, {
  auth: true,
  tags,
  summary: "List graders shared by evals, RFT rewards and promotion gates",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Graders", schema: gradersResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listGraders(serviceContext, params.workspaceId, query.projectId),
});

addRoute(app, "post", `${base}/graders`, {
  auth: true,
  tags,
  summary: "Create a grader",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: createGraderRequestSchema,
  responses: { 200: { description: "Grader", schema: graderSchema } },
  handler: ({ serviceContext, params, body }) =>
    createGrader(serviceContext, params.workspaceId, body),
});

addRoute(app, "put", `${base}/graders/:graderId`, {
  auth: true,
  tags,
  summary: "Update a grader",
  paramSchema: modelGraderParamsSchema,
  bodySchema: createGraderRequestSchema,
  responses: { 200: { description: "Grader", schema: graderSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateGrader(serviceContext, params.workspaceId, params.graderId, body),
});

addRoute(app, "delete", `${base}/graders/:graderId`, {
  auth: true,
  tags,
  summary: "Delete a grader",
  paramSchema: modelGraderParamsSchema,
  responses: deleted,
  handler: ({ serviceContext, params }) =>
    deleteGrader(serviceContext, params.workspaceId, params.graderId),
});

addRoute(app, "post", `${base}/graders/:graderId/preview`, {
  auth: true,
  tags,
  summary: "Score one output with a grader",
  paramSchema: modelGraderParamsSchema,
  bodySchema: graderPreviewRequestSchema,
  responses: { 200: { description: "Score", schema: graderPreviewSchema } },
  handler: ({ serviceContext, params, body }) =>
    previewGrader(serviceContext, params.workspaceId, params.graderId, body),
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
  responses: deleted,
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

export default app;
