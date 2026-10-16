import type { RouteHealth } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ModelEvalRepository } from "~/modules/model-evaluation/infrastructure/ModelEvalRepository";
import { ModelGraderRepository } from "~/modules/model-evaluation/infrastructure/ModelGraderRepository";
import { notFound, requireModelAction } from "~/modules/model-registry/application/access";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { findModelConfig } from "~/modules/models/application/resolve";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";

const HEALTH_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRouteHealth(
  context: ServiceContext,
  workspaceId: string,
  routeId: string,
): Promise<RouteHealth> {
  await requireModelAction(context, workspaceId, "view");

  const repositories = context.repositories;
  const route = await repositories.get(ModelRouteRepository).getRoute(workspaceId, routeId);

  if (!route) {
    throw notFound("Route");
  }

  const model = await findModelConfig(route.provider_model_id, context.env, route.provider);
  const resources = [
    ...new Set([route.provider_model_id, model?.matchingModel].filter((value) => Boolean(value))),
  ].filter((value): value is string => typeof value === "string");
  const since = new Date(Date.now() - HEALTH_WINDOW_DAYS * DAY_MS).toISOString();
  const [usage, runs] = await Promise.all([
    repositories.get(UsageEventRepository).summariseModelUsage({
      workspaceId,
      vendor: route.provider,
      resources,
      since,
    }),
    repositories.get(ModelEvalRepository).listRuns({ routeIds: [route.id], limit: 100 }),
  ]);
  const completed = runs.filter((run) => run.status === "completed");
  const suites = new Map(
    await Promise.all(
      [...new Set(completed.map((run) => run.suite_id))].map(
        async (suiteId) =>
          [suiteId, await repositories.get(ModelEvalRepository).getSuiteById(suiteId)] as const,
      ),
    ),
  );
  const graders = new Map(
    (
      await repositories
        .get(ModelGraderRepository)
        .listByIds([
          ...new Set([...suites.values()].flatMap((suite) => suite?.grader_ids.slice(0, 1) ?? [])),
        ])
    ).map((grader) => [grader.id, grader.metric] as const),
  );
  const primaryMetric = (suiteId: string) => {
    const graderId = suites.get(suiteId)?.grader_ids[0];

    return graderId ? graders.get(graderId) : undefined;
  };

  const baselineRun = completed.find((run) => run.trigger !== "replay");
  const baselineMetric = baselineRun ? primaryMetric(baselineRun.suite_id) : undefined;
  const replayTrend = completed
    .filter((run) => run.trigger === "replay" && run.suite_id === baselineRun?.suite_id)
    .flatMap((run) => {
      const metric = primaryMetric(run.suite_id);
      const score = metric ? run.scores[metric] : undefined;

      return metric && score ? [{ at: run.created_at, score: score.mean, metric }] : [];
    })
    .reverse();

  return {
    routeId: route.id,
    requests: usage.requests,
    latencyP95Ms: completed.find((run) => run.latency_p95_ms !== null)?.latency_p95_ms ?? null,
    inputTokens: Math.round(usage.input_tokens),
    outputTokens: Math.round(usage.output_tokens),
    costUsd: usage.cost_micros / 1_000_000,
    replayTrend,
    baseline:
      baselineRun && baselineMetric && baselineRun.scores[baselineMetric]
        ? { metric: baselineMetric, score: baselineRun.scores[baselineMetric].mean }
        : null,
  };
}
