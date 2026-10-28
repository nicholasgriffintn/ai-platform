import {
  getSystemModelLineup,
  type ModelConfig,
  type ModelConfigItem,
  type SystemModelPriority,
  type SystemModelRanking,
  type SystemModelRole,
} from "@ngriffin_uk/polychat-schemas";

import { readMediaScore } from "./policy.js";
import { isSystemRoleModel } from "./system-models.js";

const VALUE_TOLERANCE = 0.15;

export interface RankedSystemModel {
  id: string;
  config: ModelConfigItem;
  score: number | undefined;
  cost: number;
}

function blendedCost(model: ModelConfigItem): number {
  if (model.isFree) {
    return 0;
  }

  const input = model.costPer1kInputTokens;
  const output = model.costPer1kOutputTokens;

  return input === undefined && output === undefined
    ? Number.POSITIVE_INFINITY
    : (input ?? 0) + (output ?? 0);
}

function readRankingScore(model: ModelConfigItem, ranking: SystemModelRanking): number | undefined {
  if (ranking.metric === "intelligence") {
    return model.artificialAnalysis?.intelligenceIndex ?? undefined;
  }

  if (ranking.metric === "media") {
    const score = readMediaScore(model, ranking.key);

    return score === undefined ? undefined : ranking.lowerIsBetter ? -score : score;
  }

  return undefined;
}

function compareCost(left: RankedSystemModel, right: RankedSystemModel): number {
  return left.cost - right.cost || (right.config.speed ?? 0) - (left.config.speed ?? 0);
}

function compareScore(left: RankedSystemModel, right: RankedSystemModel): number {
  return (
    (right.score ?? Number.NEGATIVE_INFINITY) - (left.score ?? Number.NEGATIVE_INFINITY) ||
    compareCost(left, right)
  );
}

export function rankSystemRoleModels(
  models: ModelConfig,
  role: SystemModelRole,
  priority: SystemModelPriority,
): RankedSystemModel[] {
  const { ranking } = getSystemModelLineup(role);
  const minContextWindow = ranking.metric === "intelligence" ? ranking.minContextWindow : undefined;
  const candidates = Object.entries(models)
    .filter(
      ([, model]) =>
        isSystemRoleModel(role, model) &&
        (!minContextWindow || (model.contextWindow ?? 0) >= minContextWindow),
    )
    .map(([id, config]) => ({
      id,
      config,
      score: readRankingScore(config, ranking),
      cost: blendedCost(config),
    }));

  if (ranking.metric === "cost") {
    return candidates.sort(compareCost);
  }

  const scores = candidates.flatMap((candidate) =>
    candidate.score === undefined ? [] : [candidate.score],
  );

  if (priority === "quality" || scores.length === 0) {
    return candidates.sort(compareScore);
  }

  const best = Math.max(...scores);
  const threshold = best - VALUE_TOLERANCE * (best - Math.min(...scores));
  const nearBest = candidates.filter(
    (candidate) => candidate.score !== undefined && candidate.score >= threshold,
  );
  const rest = candidates.filter((candidate) => !nearBest.includes(candidate));

  return [...nearBest.sort(compareCost), ...rest.sort(compareScore)];
}
