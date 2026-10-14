import {
  modelTrainingRunParamsSchema,
  registryProjectScopeQuerySchema,
  registryWorkspaceParamsSchema,
  startTrainingRunRequestSchema,
  trainingPlanRequestSchema,
  trainingPlanSchema,
  trainingRecommendationRequestSchema,
  trainingRecommendationSchema,
  trainingRunSchema,
  trainingRunsResponseSchema,
  trainingStartResultSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { planTraining, recommendTrainingPlan } from "~/modules/model-training/application/plan";
import {
  cancelTrainingRun,
  getTrainingRun,
  listTrainingRuns,
  startTrainingRun,
} from "~/modules/model-training/application/runs";

const app = new Hono();
const tags = ["model-training"];
const base = "/workspaces/:workspace_id";

addRoute(app, "post", `${base}/training/recommend`, {
  auth: true,
  tags,
  summary: "Recommend a method, base, trainer and hyperparameters for a goal",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: trainingRecommendationRequestSchema,
  responses: { 200: { description: "Recommendation", schema: trainingRecommendationSchema } },
  handler: ({ serviceContext, params, body }) =>
    recommendTrainingPlan(serviceContext, params.workspace_id, body),
});

addRoute(app, "post", `${base}/training/plan`, {
  auth: true,
  tags,
  summary: "Compare trainers, costs, compute and policy standing before starting",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: trainingPlanRequestSchema,
  responses: { 200: { description: "Plan", schema: trainingPlanSchema } },
  handler: ({ serviceContext, params, body }) =>
    planTraining(serviceContext, params.workspace_id, body),
});

addRoute(app, "get", `${base}/training/runs`, {
  auth: true,
  tags,
  summary: "List training runs",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Runs", schema: trainingRunsResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listTrainingRuns(serviceContext, params.workspace_id, query.project_id),
});

addRoute(app, "post", `${base}/training/runs`, {
  auth: true,
  tags,
  summary: "Start a training run, or file a spend request when the budget needs approval",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: startTrainingRunRequestSchema,
  responses: { 200: { description: "Start result", schema: trainingStartResultSchema } },
  handler: ({ serviceContext, params, body }) =>
    startTrainingRun(serviceContext, params.workspace_id, body),
});

addRoute(app, "get", `${base}/training/runs/:run_id`, {
  auth: true,
  tags,
  summary: "Get a run with metrics and checkpoints",
  paramSchema: modelTrainingRunParamsSchema,
  responses: { 200: { description: "Run", schema: trainingRunSchema } },
  handler: ({ serviceContext, params }) =>
    getTrainingRun(serviceContext, params.workspace_id, params.run_id),
});

addRoute(app, "post", `${base}/training/runs/:run_id/cancel`, {
  auth: true,
  tags,
  summary: "Cancel a run with its provider",
  paramSchema: modelTrainingRunParamsSchema,
  responses: { 200: { description: "Run", schema: trainingRunSchema } },
  handler: ({ serviceContext, params }) =>
    cancelTrainingRun(serviceContext, params.workspace_id, params.run_id),
});

export default app;
