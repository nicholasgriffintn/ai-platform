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
  benchmarkRunListQuerySchema,
  benchmarkRunListSchema,
  benchmarkRunsResponseSchema,
  benchmarkShareParamsSchema,
  benchmarkVoteRequestSchema,
  benchmarkVoteResultSchema,
  createBenchmarkRunsRequestSchema,
  listPageOf,
  queueOfficialBenchmarkRunsRequestSchema,
  updateBenchmarkRunRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource, defineSingleton } from "~/infrastructure/http/resource";
import { requireAdmin } from "~/middleware/adminMiddleware";

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

defineSingleton(app, { tags }, (index) => {
  index.read({
    auth: false,
    summary: "List benchmark boards",
    description:
      "Returns every benchmark with its official standings, the people's baseline and a medal table. Artificial Analysis indexes come from the model catalogue with attribution on the page.",
    responses: { 200: { description: "Benchmark boards", schema: benchmarkIndexSchema } },
    handler: ({ serviceContext }) => getBenchmarkIndex(serviceContext.repositories),
    cache: BOARD_CACHE,
  });
});

defineResource(app, { path: "/runs", idParam: "run_id", tags }, (runs) => {
  runs
    .list({
      auth: true,
      summary: "List benchmark runs",
      description: "The caller's runs, or a workspace's when workspace_id is set.",
      querySchema: benchmarkRunListQuerySchema,
      responses: { 200: { description: "Runs", schema: benchmarkRunListSchema } },
      handler: async ({ serviceContext, query }) => {
        const { runs: rows } = query.workspace_id
          ? await listWorkspaceBenchmarkRuns(serviceContext, query.workspace_id)
          : await listMyBenchmarkRuns(serviceContext);

        return listPageOf(rows, (run) => run.id);
      },
      cache: "no-store",
    })
    .create({
      auth: true,
      summary: "Start benchmark runs",
      description:
        "Runs a benchmark against up to five models you can use, including models on your own keys, or against active workspace routes when workspace_id is set. Personal runs stay private until you share them; workspace results also land as evidence on each model version.",
      bodySchema: createBenchmarkRunsRequestSchema,
      responses: { 200: { description: "Started runs", schema: benchmarkRunsResponseSchema } },
      handler: ({ serviceContext, body }) =>
        "workspace_id" in body
          ? startWorkspaceBenchmarkRuns(serviceContext, body.workspace_id, body)
          : startBenchmarkRuns(serviceContext, body),
    })
    .collectionAction("estimate", {
      auth: true,
      summary: "Check eligibility and estimate the cost of personal runs",
      bodySchema: benchmarkEstimateRequestSchema,
      responses: { 200: { description: "Estimates", schema: benchmarkEstimateSchema } },
      handler: ({ serviceContext, body }) => estimateBenchmarkRuns(serviceContext, body),
    })
    .collectionAction("queue", {
      auth: true,
      summary: "Queue official runs for models without one",
      description:
        "Queues official runs for lineup and decision models from approved labs that have not run the current version, within the monthly budget. Admins only; the daily schedule calls the same queue.",
      middleware: [requireAdmin],
      bodySchema: queueOfficialBenchmarkRunsRequestSchema,
      responses: { 200: { description: "Queued runs", schema: benchmarkQueueResultSchema } },
      handler: ({ serviceContext, body }) =>
        queueOfficialRuns(serviceContext.env, serviceContext.repositories, body),
    })
    .shared({
      auth: false,
      summary: "Read a shared benchmark run",
      paramSchema: benchmarkShareParamsSchema,
      responses: { 200: { description: "Shared run", schema: benchmarkRunDetailSchema } },
      handler: ({ serviceContext, params }) => getSharedRunDetail(serviceContext, params.token),
      cache: "no-store",
    })
    .read({
      auth: true,
      summary: "Read a benchmark run",
      paramSchema: benchmarkRunParamsSchema,
      responses: { 200: { description: "Run detail", schema: benchmarkRunDetailSchema } },
      handler: ({ serviceContext, params }) => getManagedRunDetail(serviceContext, params.run_id),
      cache: "no-store",
    })
    .update({
      auth: true,
      summary: "Share, unshare, withdraw or restore a benchmark run",
      description: "Owners manage their runs; admins also manage official runs.",
      paramSchema: benchmarkRunParamsSchema,
      bodySchema: updateBenchmarkRunRequestSchema,
      responses: { 200: { description: "The run", schema: benchmarkRunSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateBenchmarkRunVisibility(serviceContext, params.run_id, body.visibility),
    })
    .delete({
      auth: true,
      summary: "Delete a benchmark run",
      paramSchema: benchmarkRunParamsSchema,
      handler: ({ serviceContext, params }) => deleteBenchmarkRun(serviceContext, params.run_id),
    });
});

defineResource(app, { path: "/votes", idParam: "vote_id", tags }, (votes) => {
  votes.create({
    auth: true,
    summary: "Vote on a blind arena pair",
    bodySchema: benchmarkVoteRequestSchema,
    responses: { 200: { description: "Revealed pair", schema: benchmarkVoteResultSchema } },
    handler: ({ serviceContext, body, user }) =>
      submitArenaVote(serviceContext.env, serviceContext.repositories, user, body),
  });
});

defineResource(app, { path: "/plays", idParam: "play_id", tags }, (plays) => {
  plays.create({
    auth: true,
    summary: "Score a game you played",
    bodySchema: benchmarkPlaySubmitRequestSchema,
    responses: { 200: { description: "Your result", schema: benchmarkPlayResultSchema } },
    handler: ({ serviceContext, body, user }) =>
      submitBenchmarkPlay(serviceContext.env, serviceContext.repositories, user, body),
  });
});

defineResource(app, { idParam: "benchmark_id", tags }, (benchmarks) => {
  benchmarks
    .read({
      auth: false,
      summary: "Read one benchmark board",
      paramSchema: benchmarkIdParamsSchema,
      responses: { 200: { description: "Benchmark board", schema: benchmarkBoardSchema } },
      handler: ({ serviceContext, params }) =>
        getBenchmarkBoard(serviceContext.repositories, params.benchmark_id),
      cache: BOARD_CACHE,
    })
    .action("play", {
      auth: true,
      summary: "Start a game against the board",
      paramSchema: benchmarkIdParamsSchema,
      responses: { 200: { description: "A new game", schema: benchmarkPlayStartSchema } },
      handler: ({ serviceContext, params }) =>
        startBenchmarkPlay(serviceContext.env, params.benchmark_id),
    });

  benchmarks.singleton("arena").read({
    auth: true,
    summary: "Draw a blind pair to vote on",
    paramSchema: benchmarkIdParamsSchema,
    responses: { 200: { description: "Arena pair", schema: benchmarkArenaResponseSchema } },
    handler: ({ serviceContext, params }) =>
      getArenaPair(serviceContext.env, serviceContext.repositories, params.benchmark_id),
    cache: "no-store",
  });

  benchmarks.sub("models", "model_id").read({
    auth: false,
    summary: "Read a model's official run on one benchmark",
    paramSchema: benchmarkEntrantParamsSchema,
    responses: { 200: { description: "Entrant detail", schema: benchmarkRunDetailSchema } },
    handler: ({ serviceContext, params }) =>
      getEntrantDetail(
        serviceContext.env,
        serviceContext.repositories,
        params.benchmark_id,
        params.model_id,
      ),
    cache: BOARD_CACHE,
  });

  benchmarks.sub("photos", "photo_id").read({
    auth: false,
    summary: "Read a benchmark photo",
    description: "Serves a cached copy of the photo with its metadata stripped.",
    paramSchema: benchmarkPhotoParamsSchema,
    handler: async ({ serviceContext, params }) =>
      new Response(
        await loadBenchmarkPhoto(serviceContext.env, params.benchmark_id, params.photo_id),
        { headers: { "Content-Type": "image/jpeg", "Cache-Control": PHOTO_CACHE_CONTROL } },
      ),
  });
});

export default app;
