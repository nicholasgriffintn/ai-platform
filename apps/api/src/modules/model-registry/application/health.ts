import type { RouteHealth } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { findModelConfig } from "~/modules/models/application/resolve";

import { notFound, requireRegistryMember } from "./access";

const HEALTH_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRouteHealth(
  context: ServiceContext,
  workspaceId: string,
  routeId: string,
): Promise<RouteHealth> {
  await requireRegistryMember(context, workspaceId);

  const repositories = context.repositories;
  const route = await repositories.modelRoutes.getRoute(workspaceId, routeId);

  if (!route) {
    throw notFound("Route");
  }

  const model = await findModelConfig(route.provider_model_id, context.env, route.provider);
  const resources = [
    ...new Set([route.provider_model_id, model?.matchingModel].filter((value) => Boolean(value))),
  ].filter((value): value is string => typeof value === "string");
  const since = new Date(Date.now() - HEALTH_WINDOW_DAYS * DAY_MS).toISOString();
  const [usage, runs] = await Promise.all([
    repositories.usageEvents.summariseModelUsage({
      workspaceId,
      vendor: route.provider,
      resources,
      since,
    }),
    repositories.modelEvals.listRuns({ routeIds: [route.id], limit: 100 }),
  ]);
  const completed = runs.filter((run) => run.status === "completed");
  const suites = new Map(
    await Promise.all(
      [...new Set(completed.map((run) => run.suite_id))].map(
        async (suiteId) => [suiteId, await repositories.modelEvals.getSuiteById(suiteId)] as const,
      ),
    ),
  );
  const primaryMetric = (suiteId: string) => suites.get(suiteId)?.scorers[0]?.metric;
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
