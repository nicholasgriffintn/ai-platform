import {
  getModelDisplayName,
  getLineupModelsByRuntime,
  isLineupEligibleModel,
  MODEL_TIER_ROLES,
  MODEL_TIERS,
  resolveLineupCandidate,
  resolveModelTierSelection,
  type ModelConfig,
  type ModelConfigItem,
  type ModelLineupCandidate,
  type ModelLineupRuntime,
  type ModelTier,
  type ModelTierLineup,
  type ModelTierRole,
  type ReasoningEffort,
  type ResolvedModelTier,
} from "@ngriffin_uk/polychat-schemas";

export interface LineupEntryView {
  id: string;
  name: string;
  provider: string;
  model: ModelConfigItem | null;
  effort?: ReasoningEffort;
  candidateIndex: number;
}

const WEB_LLM_SUFFIX = /-(q\d+f\d+(_\d+)?)-MLC(-\d+k)?$/u;

export function formatWebLlmModelName(id: string): string {
  return id.replace(WEB_LLM_SUFFIX, "").replace(/-/gu, " ");
}

function describeCandidate(candidate: ModelLineupCandidate): LineupEntryView {
  return {
    id: candidate.model,
    name:
      candidate.provider === "web-llm"
        ? formatWebLlmModelName(candidate.model)
        : (candidate.model.split("/").pop() ?? candidate.model),
    provider: candidate.provider,
    model: null,
    effort: candidate.effort,
    candidateIndex: 0,
  };
}

export function resolveLineupHeadline(
  models: Record<string, ModelConfigItem>,
  candidates: readonly ModelLineupCandidate[],
  isEligible?: (model: ModelConfigItem) => boolean,
): LineupEntryView | null {
  if (candidates.length === 0) {
    return null;
  }

  const resolved = resolveLineupCandidate(models, candidates, isEligible ? { isEligible } : {});

  if (!resolved) {
    return isEligible ? null : describeCandidate(candidates[0]);
  }

  return {
    id: resolved.id,
    name: getModelDisplayName(resolved.config),
    provider: resolved.config.provider,
    model: resolved.config,
    effort: resolved.effort,
    candidateIndex: candidates.indexOf(resolved.candidate),
  };
}

export function toModelRecordById(models: ModelConfigItem[]): Record<string, ModelConfigItem> {
  return Object.fromEntries(models.map((model) => [model.id ?? model.matchingModel, model]));
}

function formatResolvedTier(
  selection: ReturnType<typeof resolveModelTierSelection> | null,
): ResolvedModelTier | null {
  if (!selection) {
    return null;
  }

  return {
    id: selection.id,
    name: getModelDisplayName(selection.config),
    provider: selection.config.provider,
    ...(selection.effort ? { effort: selection.effort } : {}),
  };
}

function resolveLocalTierRole(
  models: ModelConfig,
  runtime: ModelLineupRuntime,
  tier: ModelTier,
  role: ModelTierRole,
  machineId?: string,
): ResolvedModelTier | null {
  const runtimeModels = getLineupModelsByRuntime(models, runtime, machineId);
  const selection = resolveModelTierSelection(runtimeModels, runtime, tier, role, {
    isEligible: isLineupEligibleModel,
  });

  if (selection) {
    return formatResolvedTier(selection);
  }

  if (runtime === "hosted") {
    return null;
  }

  const fallback = Object.entries(runtimeModels).find(([, model]) => isLineupEligibleModel(model));

  if (!fallback) {
    return null;
  }

  const [id, model] = fallback;

  return {
    id,
    name: getModelDisplayName(model),
    provider: model.provider,
  };
}

export function resolveLocalModelTierLineup(
  models: ModelConfig,
  runtime: ModelLineupRuntime,
  machineId?: string,
): ModelTierLineup {
  return Object.fromEntries(
    MODEL_TIERS.map((tier) => [
      tier,
      Object.fromEntries(
        MODEL_TIER_ROLES.map((role) => [
          role,
          resolveLocalTierRole(models, runtime, tier, role, machineId),
        ]),
      ),
    ]),
  ) as ModelTierLineup;
}

export function resolveModelTierLineup(
  models: ModelConfig,
  runtime: ModelLineupRuntime,
  machineId?: string,
): ModelTierLineup {
  return resolveLocalModelTierLineup(models, runtime, machineId);
}

export function mergeModelTierLineups(
  primary: ModelTierLineup | undefined,
  fallback: ModelTierLineup,
): ModelTierLineup {
  return Object.fromEntries(
    MODEL_TIERS.map((tier) => [
      tier,
      Object.fromEntries(
        MODEL_TIER_ROLES.map((role) => [role, primary?.[tier][role] ?? fallback[tier][role]]),
      ),
    ]),
  ) as ModelTierLineup;
}
