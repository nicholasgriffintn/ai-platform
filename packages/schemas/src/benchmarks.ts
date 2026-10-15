import z from "zod/v4";

import { scoreSummarySchema } from "./model-registry.js";
import { listSchema } from "./platform/list.js";

export const BENCHMARK_RUN_TASK_TYPE = "benchmark_run" as const;

export const BENCHMARK_IDS = [
  "geoguess",
  "hamster-wheel",
  "countdown",
  "fermi-bets",
  "long-odds",
  "strudel-groove",
  "smuggled-note",
  "keep-a-secret",
  "yes-man",
] as const;

export const benchmarkIdSchema = z.enum(BENCHMARK_IDS);
export const benchmarkScoringSchema = z.enum(["auto", "votes"]);
export const benchmarkInputSchema = z.enum(["text", "image"]);
export const benchmarkArtefactKindSchema = z.enum(["html", "strudel"]);
export const benchmarkCategorySchema = z.enum([
  "Vision",
  "Creative",
  "Reasoning",
  "Calibration",
  "Alignment",
]);
export const benchmarkScopeSchema = z.enum(["official", "personal", "workspace", "human"]);
export const benchmarkRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const benchmarkVisibilitySchema = z.enum(["private", "link", "public"]);
export const benchmarkVoteWinnerSchema = z.enum(["left", "right", "tie"]);
export const benchmarkMetricFormatSchema = z.enum(["number", "percent", "km", "decades"]);

export const benchmarkMetricDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  format: benchmarkMetricFormatSchema,
  lowerIsBetter: z.boolean().optional(),
});

export const benchmarkSummarySchema = z.object({
  id: benchmarkIdSchema,
  version: z.number().int().positive(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  method: z.string(),
  category: benchmarkCategorySchema,
  scoring: benchmarkScoringSchema,
  input: benchmarkInputSchema,
  artefact: benchmarkArtefactKindSchema.nullable(),
  playable: z.boolean(),
  decisionModels: z.boolean(),
  itemCount: z.number().int().positive(),
  itemsPerPlay: z.number().int().positive(),
  scoreScale: z.number().positive(),
  scoreUnit: z.string(),
  metrics: z.array(benchmarkMetricDefinitionSchema),
  credit: z.object({ label: z.string(), url: z.string() }).nullable(),
});

export const benchmarkEntrantHostSchema = z.object({
  modelId: z.string(),
  provider: z.string(),
});

export const benchmarkEntrantSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("model"),
    modelId: z.string(),
    provider: z.string(),
    name: z.string(),
    via: benchmarkEntrantHostSchema.optional(),
  }),
  z.object({
    kind: z.literal("route"),
    workspaceId: z.string(),
    routeId: z.string(),
    versionId: z.string(),
    name: z.string(),
  }),
  z.object({ kind: z.literal("human"), name: z.string() }),
]);

export const benchmarkUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
  latencyP50Ms: z.number().nonnegative().nullable(),
});

export const benchmarkRatingSchema = z.object({
  rating: z.number(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  winRate: scoreSummarySchema,
});

export const benchmarkRunSchema = z.object({
  id: z.string(),
  benchmarkId: benchmarkIdSchema,
  version: z.number().int().positive(),
  entrant: benchmarkEntrantSchema,
  scope: benchmarkScopeSchema,
  status: benchmarkRunStatusSchema,
  visibility: benchmarkVisibilitySchema,
  itemsTotal: z.number().int().nonnegative(),
  itemsCompleted: z.number().int().nonnegative(),
  score: scoreSummarySchema.nullable(),
  metrics: z.record(z.string(), z.number()),
  rating: benchmarkRatingSchema.nullable(),
  usage: benchmarkUsageSchema,
  shareToken: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const benchmarkArtefactSchema = z.object({
  kind: benchmarkArtefactKindSchema,
  content: z.string(),
});

export const benchmarkItemPublicSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  imagePath: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
});

export const benchmarkItemResultSchema = z.object({
  itemId: z.string(),
  score: z.number().min(0).max(1).nullable(),
  answer: z.unknown(),
  output: z.string(),
  artefact: benchmarkArtefactSchema.nullable(),
  detail: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  error: z.string().nullable(),
  attempts: z.number().int().nonnegative().optional(),
  latencyMs: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
});

export const benchmarkItemDetailSchema = z.object({
  item: benchmarkItemPublicSchema,
  reveal: z.record(z.string(), z.unknown()),
  result: benchmarkItemResultSchema.nullable(),
});

export const benchmarkArtificialAnalysisSchema = z.object({
  intelligenceIndex: z.number().nullable(),
  codingIndex: z.number().nullable(),
  agenticIndex: z.number().nullable(),
});

export const benchmarkStandingSchema = z.object({
  rank: z.number().int().positive(),
  tied: z.boolean(),
  runId: z.string(),
  entrant: benchmarkEntrantSchema,
  score: scoreSummarySchema.nullable(),
  rating: benchmarkRatingSchema.nullable(),
  metrics: z.record(z.string(), z.number()),
  costPerItemUsd: z.number().nullable(),
  latencyP50Ms: z.number().nullable(),
  artificialAnalysis: benchmarkArtificialAnalysisSchema.nullable(),
});

export const benchmarkBoardSchema = z.object({
  benchmark: benchmarkSummarySchema,
  standings: z.array(benchmarkStandingSchema),
  human: benchmarkStandingSchema.nullable(),
});

export const benchmarkMedalSchema = z.object({
  entrant: benchmarkEntrantSchema,
  gold: z.number().int().nonnegative(),
  silver: z.number().int().nonnegative(),
  bronze: z.number().int().nonnegative(),
});

export const benchmarkIndexSchema = z.object({
  boards: z.array(benchmarkBoardSchema),
  medals: z.array(benchmarkMedalSchema),
});

export const benchmarkRunDetailSchema = z.object({
  benchmark: benchmarkSummarySchema,
  run: benchmarkRunSchema,
  items: z.array(benchmarkItemDetailSchema),
  officialRank: z.number().int().positive().nullable(),
  officialCount: z.number().int().nonnegative(),
});

export const benchmarkRunsResponseSchema = z.object({ runs: z.array(benchmarkRunSchema) });

export const benchmarkRunListSchema = listSchema(benchmarkRunSchema);

export const benchmarkRunListQuerySchema = z.object({ workspace_id: z.string().min(1).optional() });

export const startBenchmarkRunsRequestSchema = z.object({
  benchmarkId: benchmarkIdSchema,
  modelIds: z.array(z.string().min(1)).min(1).max(5),
});

export const startWorkspaceBenchmarkRunsRequestSchema = z.object({
  benchmarkId: benchmarkIdSchema,
  routeIds: z.array(z.string().min(1)).min(1).max(5),
});

export const createBenchmarkRunsRequestSchema = z.union([
  startWorkspaceBenchmarkRunsRequestSchema.extend({ workspace_id: z.string().min(1) }),
  startBenchmarkRunsRequestSchema,
]);

export const queueOfficialBenchmarkRunsRequestSchema = z.object({
  benchmarkIds: z.array(benchmarkIdSchema).optional(),
  modelIds: z.array(z.string().min(1)).max(50).optional(),
  retryFailed: z.boolean().optional(),
});

export const benchmarkQueueResultSchema = z.object({
  queued: z.array(benchmarkRunSchema),
  skippedForBudget: z.boolean(),
  spentThisMonthUsd: z.number(),
  remaining: z.number().int().nonnegative(),
});

export const benchmarkCredentialSourceSchema = z.enum(["platform", "byok", "mirror"]);

export const benchmarkOfficialEntrantStatusSchema = z.enum([
  "missing",
  "unavailable",
  "ineligible",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const benchmarkOfficialEntrantSchema = z.object({
  modelId: z.string(),
  name: z.string(),
  provider: z.string(),
  status: benchmarkOfficialEntrantStatusSchema,
  reason: z.string().nullable(),
  credential: benchmarkCredentialSourceSchema.nullable(),
  run: benchmarkRunSchema.nullable(),
});

export const benchmarkOfficialBoardSchema = z.object({
  benchmark: benchmarkSummarySchema,
  entrants: z.array(benchmarkOfficialEntrantSchema),
});

export const benchmarkOfficialOverviewSchema = z.object({
  budget: z.object({
    monthlyUsd: z.number().nonnegative(),
    spentThisMonthUsd: z.number().nonnegative(),
  }),
  boards: z.array(benchmarkOfficialBoardSchema),
});

export const benchmarkEstimateSchema = z.object({
  estimates: z.array(
    z.object({
      modelId: z.string(),
      name: z.string(),
      eligible: z.boolean(),
      reason: z.string().nullable(),
      estimatedCostUsd: z.number().nullable(),
      byok: z.boolean(),
    }),
  ),
});

export const updateBenchmarkRunRequestSchema = z.object({
  visibility: benchmarkVisibilitySchema,
});

export const benchmarkArenaPairSchema = z.object({
  token: z.string(),
  benchmarkId: benchmarkIdSchema,
  prompt: z.string(),
  left: benchmarkArtefactSchema,
  right: benchmarkArtefactSchema,
});

export const benchmarkArenaResponseSchema = z.object({
  pair: benchmarkArenaPairSchema.nullable(),
});

export const benchmarkVoteRequestSchema = z.object({
  token: z.string().min(1),
  winner: benchmarkVoteWinnerSchema,
});

export const benchmarkVoteResultSchema = z.object({
  left: z.string(),
  right: z.string(),
  winner: benchmarkVoteWinnerSchema,
});

export const benchmarkPlayStartSchema = z.object({
  token: z.string(),
  benchmark: benchmarkSummarySchema,
  items: z.array(benchmarkItemPublicSchema),
});

export const benchmarkPlaySubmitRequestSchema = z.object({
  token: z.string().min(1),
  answers: z.array(z.object({ itemId: z.string(), answer: z.unknown() })).max(20),
});

export const benchmarkPlayRequestSchema = z.union([
  benchmarkPlaySubmitRequestSchema,
  z.object({}).strict(),
]);

export const benchmarkPlayResultSchema = z.object({
  run: benchmarkRunSchema,
  items: z.array(benchmarkItemDetailSchema),
  officialRank: z.number().int().positive().nullable(),
  officialCount: z.number().int().nonnegative(),
});

export const benchmarkIdParamsSchema = z.object({ benchmark_id: benchmarkIdSchema });
export const benchmarkRunParamsSchema = z.object({ run_id: z.string().min(1) });
export const benchmarkShareParamsSchema = z.object({ token: z.string().min(1) });
export const benchmarkEntrantParamsSchema = benchmarkIdParamsSchema.extend({
  model_id: z.string().min(1),
});
export const benchmarkPhotoParamsSchema = benchmarkIdParamsSchema.extend({
  photo_id: z.string().min(1),
});

export const benchmarkRunTaskDataSchema = z.object({
  runId: z.string(),
  retryChecks: z.boolean().optional(),
});

export const retryBenchmarkRunRequestSchema = z.object({
  failedChecks: z.boolean().optional(),
});

export const modelBenchmarkStandingSchema = z.object({
  benchmarkId: benchmarkIdSchema,
  name: z.string(),
  rank: z.number().int().positive().nullable(),
  of: z.number().int().nonnegative(),
  display: z.string(),
  ratio: z.number().min(0).max(1),
  personal: z.boolean(),
});

export type BenchmarkId = z.infer<typeof benchmarkIdSchema>;
export type BenchmarkScoring = z.infer<typeof benchmarkScoringSchema>;
export type BenchmarkCategory = z.infer<typeof benchmarkCategorySchema>;
export type BenchmarkArtefactKind = z.infer<typeof benchmarkArtefactKindSchema>;
export type BenchmarkScope = z.infer<typeof benchmarkScopeSchema>;
export type BenchmarkRunStatus = z.infer<typeof benchmarkRunStatusSchema>;
export type BenchmarkVisibility = z.infer<typeof benchmarkVisibilitySchema>;
export type BenchmarkVoteWinner = z.infer<typeof benchmarkVoteWinnerSchema>;
export type BenchmarkMetricDefinition = z.infer<typeof benchmarkMetricDefinitionSchema>;
export type BenchmarkSummary = z.infer<typeof benchmarkSummarySchema>;
export type BenchmarkEntrant = z.infer<typeof benchmarkEntrantSchema>;
export type BenchmarkEntrantHost = z.infer<typeof benchmarkEntrantHostSchema>;
export type BenchmarkUsage = z.infer<typeof benchmarkUsageSchema>;
export type BenchmarkRating = z.infer<typeof benchmarkRatingSchema>;
export type BenchmarkRun = z.infer<typeof benchmarkRunSchema>;
export type BenchmarkArtefact = z.infer<typeof benchmarkArtefactSchema>;
export type BenchmarkItemPublic = z.infer<typeof benchmarkItemPublicSchema>;
export type BenchmarkItemResult = z.infer<typeof benchmarkItemResultSchema>;
export type BenchmarkItemDetail = z.infer<typeof benchmarkItemDetailSchema>;
export type BenchmarkArtificialAnalysis = z.infer<typeof benchmarkArtificialAnalysisSchema>;
export type BenchmarkStanding = z.infer<typeof benchmarkStandingSchema>;
export type BenchmarkBoard = z.infer<typeof benchmarkBoardSchema>;
export type BenchmarkMedal = z.infer<typeof benchmarkMedalSchema>;
export type BenchmarkIndex = z.infer<typeof benchmarkIndexSchema>;
export type BenchmarkRunDetail = z.infer<typeof benchmarkRunDetailSchema>;
export type StartBenchmarkRunsRequest = z.infer<typeof startBenchmarkRunsRequestSchema>;
export type StartWorkspaceBenchmarkRunsRequest = z.infer<
  typeof startWorkspaceBenchmarkRunsRequestSchema
>;
export type QueueOfficialBenchmarkRunsRequest = z.infer<
  typeof queueOfficialBenchmarkRunsRequestSchema
>;
export type BenchmarkEstimate = z.infer<typeof benchmarkEstimateSchema>;
export type BenchmarkArenaPair = z.infer<typeof benchmarkArenaPairSchema>;
export type BenchmarkVoteRequest = z.infer<typeof benchmarkVoteRequestSchema>;
export type BenchmarkVoteResult = z.infer<typeof benchmarkVoteResultSchema>;
export type BenchmarkPlayStart = z.infer<typeof benchmarkPlayStartSchema>;
export type BenchmarkPlaySubmitRequest = z.infer<typeof benchmarkPlaySubmitRequestSchema>;
export type BenchmarkPlayResult = z.infer<typeof benchmarkPlayResultSchema>;
export type BenchmarkRunTaskData = z.infer<typeof benchmarkRunTaskDataSchema>;
export type RetryBenchmarkRunRequest = z.infer<typeof retryBenchmarkRunRequestSchema>;
export type ModelBenchmarkStanding = z.infer<typeof modelBenchmarkStandingSchema>;

export function benchmarkEntrantKey(entrant: BenchmarkEntrant): string {
  if (entrant.kind === "model") {
    return `model:${entrant.modelId}`;
  }

  if (entrant.kind === "route") {
    return `route:${entrant.routeId}`;
  }

  return "human";
}

export function formatBenchmarkScore(
  benchmark: Pick<BenchmarkSummary, "scoreScale" | "scoreUnit">,
  mean: number,
): string {
  const value = mean * benchmark.scoreScale;
  const rounded =
    benchmark.scoreScale >= 1000
      ? Math.round(value).toLocaleString("en-GB")
      : value.toFixed(benchmark.scoreScale >= 100 ? 0 : 1);

  return `${rounded} ${benchmark.scoreUnit}`;
}

export function formatBenchmarkStanding(
  benchmark: Pick<BenchmarkSummary, "scoreScale" | "scoreUnit" | "scoring">,
  standing: Pick<BenchmarkStanding, "score" | "rating">,
): string {
  if (benchmark.scoring === "votes" && standing.rating) {
    return `${Math.round(standing.rating.rating).toLocaleString("en-GB")} rating`;
  }

  return standing.score ? formatBenchmarkScore(benchmark, standing.score.mean) : "No score";
}

export type BenchmarkQueueResult = z.infer<typeof benchmarkQueueResultSchema>;
export type BenchmarkCredentialSource = z.infer<typeof benchmarkCredentialSourceSchema>;
export type BenchmarkOfficialEntrantStatus = z.infer<typeof benchmarkOfficialEntrantStatusSchema>;
export type BenchmarkOfficialEntrant = z.infer<typeof benchmarkOfficialEntrantSchema>;
export type BenchmarkOfficialBoard = z.infer<typeof benchmarkOfficialBoardSchema>;
export type BenchmarkOfficialOverview = z.infer<typeof benchmarkOfficialOverviewSchema>;

export function isActiveBenchmarkRunStatus(status: BenchmarkRunStatus): boolean {
  return status === "queued" || status === "running";
}
