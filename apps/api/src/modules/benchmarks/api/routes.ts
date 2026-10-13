import {
  benchmarkArenaResponseSchema,
  benchmarkBoardSchema,
  benchmarkEntrantParamsSchema,
  benchmarkEstimateRequestSchema,
  benchmarkEstimateSchema,
  benchmarkIdParamsSchema,
  benchmarkIndexSchema,
  benchmarkPhotoParamsSchema,
  benchmarkPlayResultSchema,
  benchmarkPlayStartSchema,
  benchmarkPlaySubmitRequestSchema,
  benchmarkQueueResultSchema,
  benchmarkRunDetailSchema,
  benchmarkRunParamsSchema,
  benchmarkRunSchema,
  benchmarkRunsResponseSchema,
  benchmarkShareParamsSchema,
  benchmarkVoteRequestSchema,
  benchmarkVoteResultSchema,
  queueOfficialBenchmarkRunsRequestSchema,
  startBenchmarkRunsRequestSchema,
  startWorkspaceBenchmarkRunsRequestSchema,
  updateBenchmarkRunRequestSchema,
  workspaceBenchmarkParamsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { requireAdmin } from "~/middleware/adminMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";

import { getArenaPair, submitArenaVote } from "../application/arena";
import { getBenchmarkBoard, getBenchmarkIndex, getEntrantDetail } from "../application/boards";
import { queueOfficialRuns } from "../application/official";
import { loadBenchmarkPhoto } from "../application/photos";
import { startBenchmarkPlay, submitBenchmarkPlay } from "../application/play";
import {
  deleteBenchmarkRun,
  estimateBenchmarkRuns,
  getManagedRunDetail,
  getSharedRunDetail,
  listMyBenchmarkRuns,
  listWorkspaceBenchmarkRuns,
  startBenchmarkRuns,
  startWorkspaceBenchmarkRuns,
  updateBenchmarkRunVisibility,
} from "../application/runs";

const app = new Hono();
const tags = ["benchmarks"];
const BOARD_CACHE = { maxAge: 120, staleWhileRevalidate: 600 };
const PHOTO_CACHE_CONTROL = "public, max-age=604800, immutable";

const routeLogger = createRouteLogger("benchmarks");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing benchmarks route: ${c.req.path}`);

  return next();
});

addRoute(app, "get", "/", {
  tags,
  summary: "List benchmark boards",
  description:
    "Returns every benchmark with its official standings, the people's baseline and a medal table. Artificial Analysis indexes come from the model catalogue with attribution on the page.",
  responses: { 200: { description: "Benchmark boards", schema: benchmarkIndexSchema } },
  handler: ({ serviceContext }) => getBenchmarkIndex(serviceContext.repositories),
  cache: BOARD_CACHE,
});

addRoute(app, "get", "/shared/:token", {
  tags,
  summary: "Read a shared benchmark run",
  paramSchema: benchmarkShareParamsSchema,
  responses: { 200: { description: "Shared run", schema: benchmarkRunDetailSchema } },
  handler: ({ serviceContext, params }) => getSharedRunDetail(serviceContext, params.token),
  cache: "no-store",
});

addRoute(app, "post", "/runs/estimate", {
  auth: true,
  tags,
  summary: "Check eligibility and estimate the cost of personal runs",
  bodySchema: benchmarkEstimateRequestSchema,
  responses: { 200: { description: "Estimates", schema: benchmarkEstimateSchema } },
  handler: ({ serviceContext, body }) => estimateBenchmarkRuns(serviceContext, body),
});

addRoute(app, "post", "/runs", {
  auth: true,
  tags,
  summary: "Start personal benchmark runs",
  description:
    "Runs a benchmark against up to five models you can use, including models on your own keys. Runs stay private until you share them.",
  bodySchema: startBenchmarkRunsRequestSchema,
  responses: { 200: { description: "Started runs", schema: benchmarkRunsResponseSchema } },
  handler: ({ serviceContext, body }) => startBenchmarkRuns(serviceContext, body),
});

addRoute(app, "get", "/runs", {
  auth: true,
  tags,
  summary: "List your benchmark runs",
  responses: { 200: { description: "Your runs", schema: benchmarkRunsResponseSchema } },
  handler: ({ serviceContext }) => listMyBenchmarkRuns(serviceContext),
  cache: "no-store",
});

addRoute(app, "get", "/runs/:runId", {
  auth: true,
  tags,
  summary: "Read one of your benchmark runs",
  paramSchema: benchmarkRunParamsSchema,
  responses: { 200: { description: "Run detail", schema: benchmarkRunDetailSchema } },
  handler: ({ serviceContext, params }) => getManagedRunDetail(serviceContext, params.runId),
  cache: "no-store",
});

addRoute(app, "patch", "/runs/:runId", {
  auth: true,
  tags,
  summary: "Share or unshare a benchmark run",
  paramSchema: benchmarkRunParamsSchema,
  bodySchema: updateBenchmarkRunRequestSchema,
  responses: { 200: { description: "Updated run", schema: benchmarkRunSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateBenchmarkRunVisibility(serviceContext, params.runId, body.visibility),
});

addRoute(app, "delete", "/runs/:runId", {
  auth: true,
  tags,
  summary: "Delete one of your benchmark runs",
  paramSchema: benchmarkRunParamsSchema,
  responses: {
    200: { description: "Deleted", schema: z.object({ deleted: z.literal(true) }) },
  },
  handler: ({ serviceContext, params }) => deleteBenchmarkRun(serviceContext, params.runId),
});

addRoute(app, "post", "/votes", {
  auth: true,
  tags,
  summary: "Vote on a blind arena pair",
  bodySchema: benchmarkVoteRequestSchema,
  responses: { 200: { description: "Revealed pair", schema: benchmarkVoteResultSchema } },
  handler: ({ serviceContext, body, user }) =>
    submitArenaVote(serviceContext.env, serviceContext.repositories, user, body),
});

addRoute(app, "post", "/play/submit", {
  auth: true,
  tags,
  summary: "Score a game you played",
  bodySchema: benchmarkPlaySubmitRequestSchema,
  responses: { 200: { description: "Your result", schema: benchmarkPlayResultSchema } },
  handler: ({ serviceContext, body, user }) =>
    submitBenchmarkPlay(serviceContext.env, serviceContext.repositories, user, body),
});

addRoute(app, "get", "/workspaces/:workspaceId/runs", {
  auth: true,
  tags,
  summary: "List a workspace's benchmark runs",
  paramSchema: workspaceBenchmarkParamsSchema,
  responses: { 200: { description: "Workspace runs", schema: benchmarkRunsResponseSchema } },
  handler: ({ serviceContext, params }) =>
    listWorkspaceBenchmarkRuns(serviceContext, params.workspaceId),
  cache: "no-store",
});

addRoute(app, "post", "/workspaces/:workspaceId/runs", {
  auth: true,
  tags,
  summary: "Benchmark deployed workspace models",
  description:
    "Runs a benchmark against active workspace routes. Results also land as evidence on each model version.",
  paramSchema: workspaceBenchmarkParamsSchema,
  bodySchema: startWorkspaceBenchmarkRunsRequestSchema,
  responses: { 200: { description: "Started runs", schema: benchmarkRunsResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    startWorkspaceBenchmarkRuns(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", "/admin/queue", {
  auth: true,
  tags,
  summary: "Queue official runs for models without one",
  description:
    "Queues official runs for lineup and decision models from approved labs that have not run the current version, within the monthly budget. Models outside the approved providers are skipped, and the daily schedule calls the same queue.",
  middleware: [requireAdmin],
  bodySchema: queueOfficialBenchmarkRunsRequestSchema,
  responses: { 200: { description: "Queued runs", schema: benchmarkQueueResultSchema } },
  handler: ({ serviceContext, body }) =>
    queueOfficialRuns(serviceContext.env, serviceContext.repositories, body),
});

addRoute(app, "get", "/:benchmarkId", {
  tags,
  summary: "Read one benchmark board",
  paramSchema: benchmarkIdParamsSchema,
  responses: { 200: { description: "Benchmark board", schema: benchmarkBoardSchema } },
  handler: ({ serviceContext, params }) =>
    getBenchmarkBoard(serviceContext.repositories, params.benchmarkId),
  cache: BOARD_CACHE,
});

addRoute(app, "get", "/:benchmarkId/models/:modelId", {
  tags,
  summary: "Read a model's official run on one benchmark",
  paramSchema: benchmarkEntrantParamsSchema,
  responses: { 200: { description: "Entrant detail", schema: benchmarkRunDetailSchema } },
  handler: ({ serviceContext, params }) =>
    getEntrantDetail(
      serviceContext.env,
      serviceContext.repositories,
      params.benchmarkId,
      params.modelId,
    ),
  cache: BOARD_CACHE,
});

addRoute(app, "get", "/:benchmarkId/photos/:itemId", {
  tags,
  summary: "Read a benchmark photo",
  description: "Serves a cached copy of the photo with its metadata stripped.",
  paramSchema: benchmarkIdParamsSchema.extend(benchmarkPhotoParamsSchema.shape),
  handler: async ({ serviceContext, params }) =>
    new Response(await loadBenchmarkPhoto(serviceContext.env, params.benchmarkId, params.itemId), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": PHOTO_CACHE_CONTROL },
    }),
});

addRoute(app, "get", "/:benchmarkId/arena", {
  auth: true,
  tags,
  summary: "Draw a blind pair to vote on",
  paramSchema: benchmarkIdParamsSchema,
  responses: { 200: { description: "Arena pair", schema: benchmarkArenaResponseSchema } },
  handler: ({ serviceContext, params }) =>
    getArenaPair(serviceContext.env, serviceContext.repositories, params.benchmarkId),
  cache: "no-store",
});

addRoute(app, "post", "/:benchmarkId/play", {
  auth: true,
  tags,
  summary: "Start a game against the board",
  paramSchema: benchmarkIdParamsSchema,
  responses: { 200: { description: "A new game", schema: benchmarkPlayStartSchema } },
  handler: ({ serviceContext, params }) =>
    startBenchmarkPlay(serviceContext.env, params.benchmarkId),
});

addRoute(app, "patch", "/admin/runs/:runId", {
  auth: true,
  tags,
  summary: "Withdraw or restore an official run",
  middleware: [requireAdmin],
  paramSchema: benchmarkRunParamsSchema,
  bodySchema: updateBenchmarkRunRequestSchema,
  responses: { 200: { description: "Updated run", schema: benchmarkRunSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateBenchmarkRunVisibility(serviceContext, params.runId, body.visibility),
});

export default app;
