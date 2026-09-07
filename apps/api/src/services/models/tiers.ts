import {
  DEFAULT_MODEL_TIER,
  getLineupModelsByRuntime,
  getModelDisplayName,
  isLineupEligibleModel,
  isTextInputChatModel,
  resolveModelTierSelection,
  type ModelConfig,
  type ModelConfigItem,
  type ModelLineupRuntime,
  type ModelTier,
  type ModelTierLineup,
  type ModelTierRole,
  type ModelTiersResponse,
  type ResolvedLineupCandidate,
  type ResolvedModelTier,
} from "@ngriffin_uk/polychat-schemas";

import { getExecutableModelsForAccount } from "~/lib/providers/models/policy";
import type { IUser } from "~/types";

function isTierEligibleModel(model: ModelConfigItem): boolean {
  return isLineupEligibleModel(model) && isTextInputChatModel(model);
}

function formatResolvedTier(selection: ResolvedLineupCandidate | null): ResolvedModelTier | null {
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

function resolveTierRole(
  models: ModelConfig,
  runtime: ModelLineupRuntime,
  tier: ModelTier,
  role: ModelTierRole,
): ResolvedModelTier | null {
  return formatResolvedTier(
    resolveModelTierSelection(getLineupModelsByRuntime(models, runtime), runtime, tier, role, {
      isEligible: isTierEligibleModel,
    }),
  );
}

function resolveRuntimeLineup(models: ModelConfig, runtime: ModelLineupRuntime): ModelTierLineup {
  return {
    low: {
      agent: resolveTierRole(models, runtime, "low", "agent"),
      coding: resolveTierRole(models, runtime, "low", "coding"),
    },
    medium: {
      agent: resolveTierRole(models, runtime, "medium", "agent"),
      coding: resolveTierRole(models, runtime, "medium", "coding"),
    },
    high: {
      agent: resolveTierRole(models, runtime, "high", "agent"),
      coding: resolveTierRole(models, runtime, "high", "coding"),
    },
    ultra: {
      agent: resolveTierRole(models, runtime, "ultra", "agent"),
      coding: resolveTierRole(models, runtime, "ultra", "coding"),
    },
  };
}

export function resolveTierLineup(
  models: ModelConfig,
  user?: Pick<IUser, "plan_id">,
): ModelTiersResponse {
  const executable = getExecutableModelsForAccount(models, user);

  return {
    runtimes: {
      hosted: resolveRuntimeLineup(executable, "hosted"),
      browser: resolveRuntimeLineup(executable, "browser"),
      device: resolveRuntimeLineup(executable, "device"),
      machine: resolveRuntimeLineup(executable, "machine"),
    },
    default: DEFAULT_MODEL_TIER,
  };
}
