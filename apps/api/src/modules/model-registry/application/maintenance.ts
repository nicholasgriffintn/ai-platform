import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { IEnv } from "~/types";

import { expireDecisions } from "./decisions";
import { enqueueEvalRun } from "./evals";

const REPLAY_INTERVAL_MS = 20 * 60 * 60 * 1000;

async function scheduleReplays(
  env: IEnv,
  repositories: RepositoryManager,
  now = new Date(),
): Promise<number> {
  let scheduled = 0;

  for (const candidate of await repositories.modelEvals.listReplayCandidates()) {
    const lastReplay = await repositories.modelEvals.latestRunAt(
      candidate.suiteId,
      candidate.routeId,
      "replay",
    );

    if (lastReplay && now.getTime() - new Date(lastReplay).getTime() < REPLAY_INTERVAL_MS) {
      continue;
    }

    const [suite, route] = await Promise.all([
      repositories.modelEvals.getSuiteById(candidate.suiteId),
      repositories.modelRoutes.getRouteById(candidate.routeId),
    ]);

    if (!suite || !route || route.status !== "active") {
      continue;
    }

    await enqueueEvalRun(env, repositories, { suite, route, trigger: "replay", createdBy: null });
    scheduled += 1;
  }

  return scheduled;
}

export async function runModelGovernanceMaintenance(env: IEnv, repositories: RepositoryManager) {
  const expired = await expireDecisions(repositories);
  const replays = await scheduleReplays(env, repositories);

  return { expired, replays };
}
