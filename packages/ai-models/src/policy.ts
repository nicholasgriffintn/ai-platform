import { authorise, createAuthorisationPass } from "@ngriffin_uk/polychat-library-policy";
import {
  DEFAULT_MODEL_TIER,
  findModelByReference,
  getModelDisplayName,
  isActiveModel,
  isLineupEligibleModel,
  isTextInputChatModel,
  resolveLineupCandidate,
  resolveModelTierAlternate,
  resolveModelTierSelection,
  type ModelConfig,
  type ModelConfigItem,
  type ModelLineupCandidate,
  type ModelTier,
  type ModelTierRole,
  type ResolvedLineupCandidate,
  type ResolvedModelReference,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { AccountPlan, CredentialAuthority } from "./types.js";

export const TEXT_TO_SPEECH_ARENA_SCORE = "text_to_speechElo";

export function getExecutableModelsForAccount(
  models: ModelConfig,
  user?: AccountPlan,
): ModelConfig {
  const canExecute = createAuthorisationPass("model.execute");

  return Object.fromEntries(
    Object.entries(models).filter(([, model]) =>
      canExecute({
        plan: user?.plan_id ?? "",
        active: isActiveModel(model),
        free: model.isFree === true,
        byok: model.isByokEnabled === true,
        onDevice: model.runsOn === "device",
        platformEnabled: model.isPlatformEnabled !== false,
      }),
    ),
  );
}

export function getModelCredentialAuthority(
  model: Pick<ModelConfigItem, "isByokEnabled" | "isFree" | "isPlatformEnabled">,
  user?: AccountPlan,
): CredentialAuthority {
  return authorise("model.platform", {
    plan: user?.plan_id ?? "",
    active: true,
    free: model.isFree === true,
    byok: model.isByokEnabled === true,
    onDevice: false,
    platformEnabled: model.isPlatformEnabled !== false,
  }).allowed
    ? "platform"
    : "byok";
}

export interface TierModelOptions {
  isEligible?: (model: ModelConfigItem) => boolean;
}

function isConversationModel(model: ModelConfigItem) {
  return isLineupEligibleModel(model) && isTextInputChatModel(model);
}

function tierEligibility(options: TierModelOptions) {
  return (model: ModelConfigItem) =>
    isConversationModel(model) && (options.isEligible?.(model) ?? true);
}

export function resolveTierModel(
  models: ModelConfig,
  user: AccountPlan | undefined,
  tier: ModelTier,
  role: ModelTierRole,
  options: TierModelOptions = {},
): ResolvedLineupCandidate | null {
  return resolveModelTierSelection(
    getExecutableModelsForAccount(models, user),
    "hosted",
    tier,
    role,
    { isEligible: tierEligibility(options) },
  );
}

export interface HostedAgentModelSelection {
  id: string;
  config: ModelConfigItem;
  effort?: ResolvedLineupCandidate["effort"];
}

export function resolveHostedAgentModel(
  models: ModelConfig,
  user: AccountPlan | undefined,
  tier: ModelTier,
  role: ModelTierRole,
  explicitModel?: string,
  options: TierModelOptions = {},
): HostedAgentModelSelection | null {
  const executable = getExecutableModelsForAccount(models, user);
  const requested = explicitModel?.trim();

  if (requested) {
    const match = Object.entries(executable).find(
      ([id, config]) => id === requested || config.matchingModel === requested,
    );

    return match ? { id: match[0], config: match[1] } : null;
  }

  const selected = resolveModelTierSelection(executable, "hosted", tier, role, {
    isEligible: tierEligibility(options),
  });

  return selected
    ? {
        id: selected.id,
        config: selected.config,
        ...(selected.effort ? { effort: selected.effort } : {}),
      }
    : null;
}

export function resolveTierAlternateModel(
  models: ModelConfig,
  user: AccountPlan | undefined,
  tier: ModelTier,
  role: ModelTierRole,
  primary: ResolvedLineupCandidate,
  options: TierModelOptions = {},
): ResolvedLineupCandidate | null {
  return resolveModelTierAlternate(
    getExecutableModelsForAccount(models, user),
    "hosted",
    tier,
    role,
    primary,
    { isEligible: tierEligibility(options) },
  );
}

function firstConversationModel(
  models: ModelConfig,
  options: TierModelOptions,
): { id: string; config: ModelConfigItem } | null {
  const isEligible = tierEligibility(options);
  const selected = Object.entries(models)
    .filter(([, model]) => isEligible(model))
    .sort(([, left], [, right]) => {
      const byokDelta = Number(right.isByokEnabled === true) - Number(left.isByokEnabled === true);

      return byokDelta || getModelDisplayName(left).localeCompare(getModelDisplayName(right));
    })[0];

  return selected ? { id: selected[0], config: selected[1] } : null;
}

export function tryResolveDefaultChatModel(
  models: ModelConfig,
  user?: AccountPlan,
  options: TierModelOptions = {},
): { id: string; config: ModelConfigItem } | null {
  const tierModel = resolveTierModel(models, user, DEFAULT_MODEL_TIER, "agent", options);

  if (tierModel) {
    return { id: tierModel.id, config: tierModel.config };
  }

  return firstConversationModel(getExecutableModelsForAccount(models, user), options);
}

export function resolveDefaultChatModel(
  models: ModelConfig,
  user?: AccountPlan,
  options: TierModelOptions = {},
): { id: string; config: ModelConfigItem } {
  const selected = tryResolveDefaultChatModel(models, user, options);

  if (!selected) {
    throw new AssistantError(
      "No active chat model is available for this account",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return selected;
}

export function resolvePolicyModel(
  models: ModelConfig,
  references: readonly ModelLineupCandidate[],
  user?: AccountPlan,
): ResolvedLineupCandidate | null {
  return resolveLineupCandidate(getExecutableModelsForAccount(models, user), references);
}

export function readMediaScore(model: ModelConfigItem, key: string): number | undefined {
  return model.artificialAnalysis?.mediaScores?.find((score) => score.key === key)?.value;
}

export function rankPolicyModelsByMediaScore(
  models: ModelConfig,
  scoreKey: string,
  unscoredOrder: readonly ModelLineupCandidate[],
  user?: AccountPlan,
): ResolvedModelReference[] {
  const lineupRank = (id: string, config: ModelConfigItem) => {
    const index = unscoredOrder.findIndex((candidate) =>
      findModelByReference({ [id]: config }, candidate),
    );

    return index === -1 ? unscoredOrder.length : index;
  };

  return Object.entries(getExecutableModelsForAccount(models, user))
    .map(([id, config]) => ({
      id,
      config,
      score: readMediaScore(config, scoreKey) ?? Number.NEGATIVE_INFINITY,
      rank: lineupRank(id, config),
    }))
    .sort(
      (left, right) =>
        (left.score === right.score ? 0 : right.score - left.score) ||
        left.rank - right.rank ||
        Number(right.config.isByokEnabled === true) - Number(left.config.isByokEnabled === true),
    )
    .map(({ id, config }) => ({ id, config }));
}
