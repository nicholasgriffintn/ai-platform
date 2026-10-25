import { getBenchmark, type Benchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import { estimateUsageCost } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type {
  BenchmarkEstimate,
  BenchmarkId,
  BenchmarkRun,
  BenchmarkRunDetail,
  BenchmarkVisibility,
  ModelConfigItem,
  RetryBenchmarkRunRequest,
  StartBenchmarkRunsRequest,
  StartWorkspaceBenchmarkRunsRequest,
} from "@ngriffin_uk/polychat-schemas";
import { DAY_MS, randomHex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { BenchmarkRunRepository } from "~/modules/benchmarks/infrastructure/BenchmarkRunRepository";
import { requireModelAction } from "~/modules/model-registry/application/access";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { resolveExecutableModelForRequest } from "~/modules/models/application/access";
import type { AuthorisedModelTarget } from "~/modules/responses/application/engine/streaming/responses";
import type { IEnv, IUser } from "~/types";

import { BenchmarkResultStore } from "../infrastructure/BenchmarkResultStore";
import type { BenchmarkRunRecord } from "../infrastructure/BenchmarkRunRepository";
import { isPlatformAdmin, requireManagedRun } from "./access";
import { buildRunDetail } from "./boards";
import { modelEntrant, modelIneligibility } from "./entrants";
import { toBenchmarkRun } from "./mappers";
import { enqueueBenchmarkRunTask } from "./runner";

const SHARE_TOKEN_LENGTH = 36;

async function resolvePersonalModel(
  env: IEnv,
  user: IUser,
  modelId: string,
): Promise<AuthorisedModelTarget | null> {
  try {
    const resolved = await resolveExecutableModelForRequest({ env, user, model: modelId });

    return {
      config: { ...resolved.config, id: resolved.id },
      credentialAuthority: resolved.credentialAuthority,
    };
  } catch {
    return null;
  }
}

export function estimateRunCostUsd(benchmark: Benchmark, config: ModelConfigItem): number | null {
  const items = benchmark.summary.itemCount;
  const inputPerItem =
    BENCHMARKS_CONFIG.estimatedInputTokensPerItem +
    (benchmark.summary.input === "image" ? BENCHMARKS_CONFIG.estimatedImageTokensPerItem : 0);

  return (
    estimateUsageCost(
      {
        inputTokens: items * inputPerItem,
        outputTokens: items * BENCHMARKS_CONFIG.estimatedOutputTokensPerItem,
      },
      config,
    ) ?? null
  );
}

function canStart(user: IUser, model: AuthorisedModelTarget): boolean {
  return authorise("benchmark.run.start", {
    signedIn: true,
    plan: user.plan_id ?? "",
    byok: model.credentialAuthority === "byok",
  }).allowed;
}

export async function estimateBenchmarkRuns(
  context: ServiceContext,
  request: StartBenchmarkRunsRequest,
): Promise<BenchmarkEstimate> {
  const user = context.requireUser();
  const benchmark = getBenchmark(request.benchmarkId);

  return {
    estimates: await Promise.all(
      request.modelIds.map(async (modelId) => {
        const model = await resolvePersonalModel(context.env, user, modelId);

        if (!model) {
          return {
            modelId,
            name: modelId,
            eligible: false,
            reason: "You cannot use this model",
            estimatedCostUsd: null,
            byok: false,
          };
        }

        const byok = model.credentialAuthority === "byok";
        const reason =
          modelIneligibility(benchmark, model.config) ??
          (canStart(user, model)
            ? null
            : "Benchmarks on Polychat's keys need Pro. Add your own key to run this one");

        return {
          modelId,
          name: modelEntrant(modelId, model.config).name,
          eligible: reason === null,
          reason,
          estimatedCostUsd: estimateRunCostUsd(benchmark, model.config),
          byok,
        };
      }),
    ),
  };
}

async function requireRunAllowance(context: ServiceContext, user: IUser, count: number) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { active, recent } = await context.repositories
    .get(BenchmarkRunRepository)
    .countOwnerRunsSince(user.id, since);

  if (active + count > BENCHMARKS_CONFIG.personalActiveRuns) {
    throw new AssistantError(
      "Let your current benchmark runs finish before starting more",
      ErrorType.RATE_LIMIT_ERROR,
      429,
    );
  }

  if (recent + count > BENCHMARKS_CONFIG.personalRunsPerDay) {
    throw new AssistantError(
      "That is plenty of benchmarking for one day. Try again tomorrow",
      ErrorType.RATE_LIMIT_ERROR,
      429,
    );
  }
}

export async function startBenchmarkRuns(
  context: ServiceContext,
  request: StartBenchmarkRunsRequest,
): Promise<{ runs: BenchmarkRun[] }> {
  const user = context.requireUser();
  const benchmark = getBenchmark(request.benchmarkId);
  const modelIds = [...new Set(request.modelIds)];
  const targets = await Promise.all(
    modelIds.map(async (modelId) => {
      const model = await resolvePersonalModel(context.env, user, modelId);

      if (!model) {
        throw new AssistantError(`You cannot use ${modelId}`, ErrorType.FORBIDDEN, 403);
      }

      const reason = modelIneligibility(benchmark, model.config);

      if (reason) {
        throw new AssistantError(reason, ErrorType.PARAMS_ERROR, 400);
      }

      if (!canStart(user, model)) {
        throw new AssistantError(
          "Benchmarks on Polychat's keys need Pro. Add your own key to run this one",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      return { modelId, model };
    }),
  );

  await requireRunAllowance(context, user, targets.length);

  const runs: BenchmarkRun[] = [];

  for (const { modelId, model } of targets) {
    const record = await context.repositories.get(BenchmarkRunRepository).create({
      benchmarkId: benchmark.summary.id,
      version: benchmark.summary.version,
      scope: "personal",
      entrant: modelEntrant(modelId, model.config),
      ownerUserId: user.id,
      workspaceId: null,
      status: "queued",
      visibility: "private",
      itemsTotal: benchmark.summary.itemCount,
    });

    await enqueueBenchmarkRunTask(context.env, context.repositories, record.id, { kind: "start" });
    runs.push(toBenchmarkRun(record, { includeShareToken: true }));
  }

  return { runs };
}

export async function listMyBenchmarkRuns(
  context: ServiceContext,
): Promise<{ runs: BenchmarkRun[] }> {
  const user = context.requireUser();

  return {
    runs: (await context.repositories.get(BenchmarkRunRepository).listByOwner(user.id)).map(
      (record) => toBenchmarkRun(record, { includeShareToken: true }),
    ),
  };
}

export async function getManagedRunDetail(
  context: ServiceContext,
  runId: string,
): Promise<BenchmarkRunDetail> {
  const record = await requireManagedRun(context, runId);

  return buildRunDetail(context.env, context.repositories, record, { includeShareToken: true });
}

export async function getSharedRunDetail(
  context: ServiceContext,
  token: string,
): Promise<BenchmarkRunDetail> {
  const record = await context.repositories.get(BenchmarkRunRepository).getByShareToken(token);

  if (!record || record.visibility === "private" || record.status !== "completed") {
    throw new AssistantError("This shared run is not available", ErrorType.NOT_FOUND, 404);
  }

  return buildRunDetail(context.env, context.repositories, record);
}

function shareTokenFor(record: BenchmarkRunRecord, visibility: BenchmarkVisibility) {
  if (visibility === "private") {
    return null;
  }

  return record.share_token ?? randomHex(SHARE_TOKEN_LENGTH).toLowerCase();
}

export async function updateBenchmarkRunVisibility(
  context: ServiceContext,
  runId: string,
  visibility: BenchmarkVisibility,
): Promise<BenchmarkRun> {
  const record = await requireManagedRun(context, runId);

  if (record.scope !== "official" && visibility === "public") {
    throw new AssistantError(
      "Personal runs can be shared by link but never join the public board",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const shareToken = record.scope === "official" ? null : shareTokenFor(record, visibility);

  await context.repositories.get(BenchmarkRunRepository).update(record.id, {
    visibility,
    share_token: shareToken,
  });

  return toBenchmarkRun(
    { ...record, visibility, share_token: shareToken },
    { includeShareToken: true },
  );
}

export async function cancelBenchmarkRun(
  context: ServiceContext,
  runId: string,
): Promise<BenchmarkRun> {
  const record = await requireManagedRun(context, runId);
  const reason = "Cancelled before it finished";
  const cancelled = await context.repositories
    .get(BenchmarkRunRepository)
    .cancel(record.id, reason);

  if (!cancelled) {
    throw new AssistantError("This run is not active", ErrorType.CONFLICT_ERROR, 409);
  }

  return toBenchmarkRun(
    { ...record, status: "cancelled", failure_reason: reason },
    { includeShareToken: true },
  );
}

export async function retryBenchmarkRun(
  context: ServiceContext,
  runId: string,
  request: RetryBenchmarkRunRequest = {},
): Promise<BenchmarkRun> {
  const user = context.requireUser();
  const record = await requireManagedRun(context, runId);
  const benchmark = getBenchmark(record.benchmark_id as BenchmarkId);

  if (benchmark.summary.version !== record.version) {
    throw new AssistantError(
      "This benchmark has a new season, so start a fresh run instead",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const retryChecks = request.failedChecks === true && benchmark.summary.scoring === "votes";
  const newItems = benchmark.itemIds.length > record.items_total;
  const unanswered =
    record.status === "completed" &&
    (await BenchmarkResultStore.forEnv(context.env).readResults(record.id)).some(
      (result) => result.error !== null,
    );
  const ownerUserId = record.scope === "official" && isPlatformAdmin(user) ? user.id : undefined;
  const requeued = await context.repositories.get(BenchmarkRunRepository).requeue(record.id, {
    ownerUserId,
    fromCompleted: retryChecks || newItems || unanswered,
    itemsTotal: benchmark.itemIds.length,
  });

  if (!requeued) {
    throw new AssistantError(
      retryChecks
        ? "Only finished runs can retry their failed checks"
        : "This run has answered everything it can; only failed or cancelled runs can be retried",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const store = BenchmarkResultStore.forEnv(context.env);
  const kept = (await store.readResults(record.id))
    .filter((result) => result.error === null)
    .map((result) =>
      retryChecks && result.artefact === null && result.score === 0
        ? { ...result, attempts: 0 }
        : result,
    );

  await store.writeResults(record.id, kept);
  await enqueueBenchmarkRunTask(context.env, context.repositories, record.id, {
    kind: "retry",
    retryChecks,
  });

  return toBenchmarkRun(
    {
      ...record,
      status: "queued",
      failure_reason: null,
      completed_at: null,
      score: null,
      items_total: benchmark.itemIds.length,
      owner_user_id: ownerUserId ?? record.owner_user_id,
    },
    { includeShareToken: true },
  );
}

export async function deleteBenchmarkRun(
  context: ServiceContext,
  runId: string,
): Promise<{ deleted: true }> {
  const record = await requireManagedRun(context, runId);

  await BenchmarkResultStore.forEnv(context.env).deleteResults(record.id);
  await context.repositories.get(BenchmarkRunRepository).delete(record.id);

  return { deleted: true };
}

export async function startWorkspaceBenchmarkRuns(
  context: ServiceContext,
  workspaceId: string,
  request: StartWorkspaceBenchmarkRunsRequest,
): Promise<{ runs: BenchmarkRun[] }> {
  const { userId } = await requireModelAction(context, workspaceId, "deploy");
  const user = context.requireUser();
  const benchmark = getBenchmark(request.benchmarkId);

  if (benchmark.summary.input === "image") {
    throw new AssistantError(
      `${benchmark.summary.name} needs image input, which workspace routes do not take yet`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const routes = await Promise.all(
    [...new Set(request.routeIds)].map(async (routeId) => {
      const route = await context.repositories
        .get(ModelRouteRepository)
        .getRoute(workspaceId, routeId);

      if (!route || route.status !== "active") {
        throw new AssistantError(`Active route ${routeId} not found`, ErrorType.NOT_FOUND, 404);
      }

      return route;
    }),
  );

  await requireRunAllowance(context, user, routes.length);

  const runs: BenchmarkRun[] = [];

  for (const route of routes) {
    const record = await context.repositories.get(BenchmarkRunRepository).create({
      benchmarkId: benchmark.summary.id,
      version: benchmark.summary.version,
      scope: "workspace",
      entrant: {
        kind: "route",
        workspaceId,
        routeId: route.id,
        versionId: route.version_id,
        name: route.provider_model_id,
      },
      ownerUserId: userId,
      workspaceId,
      status: "queued",
      visibility: "private",
      itemsTotal: benchmark.summary.itemCount,
    });

    await enqueueBenchmarkRunTask(context.env, context.repositories, record.id, { kind: "start" });
    runs.push(toBenchmarkRun(record, { includeShareToken: true }));
  }

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_benchmark.started",
    targetType: "benchmark",
    targetId: benchmark.summary.id,
    metadata: { routeIds: request.routeIds, runIds: runs.map((run) => run.id) },
  });

  return { runs };
}

export async function listWorkspaceBenchmarkRuns(
  context: ServiceContext,
  workspaceId: string,
): Promise<{ runs: BenchmarkRun[] }> {
  await requireModelAction(context, workspaceId, "view");

  return {
    runs: (await context.repositories.get(BenchmarkRunRepository).listByWorkspace(workspaceId)).map(
      (record) => toBenchmarkRun(record, { includeShareToken: true }),
    ),
  };
}
