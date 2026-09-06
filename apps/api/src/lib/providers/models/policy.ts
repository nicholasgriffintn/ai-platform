import {
  DEFAULT_MODEL_TIER,
  getModelDisplayName,
  isActiveModel,
  isLineupEligibleModel,
  isModelSelectableForAccount,
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
} from "@ngriffin_uk/polychat-schemas";

import type { CredentialAuthority, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export function getExecutableModelsForAccount(
  models: ModelConfig,
  user?: Pick<IUser, "plan_id">,
): ModelConfig {
  const isPro = user?.plan_id === "pro";

  return Object.fromEntries(
    Object.entries(models).filter(
      ([, model]) =>
        isActiveModel(model) &&
        isModelSelectableForAccount(model, isPro) &&
        (model.isPlatformEnabled !== false || model.isByokEnabled === true),
    ),
  );
}

export function getModelCredentialAuthority(
  model: Pick<ModelConfigItem, "isByokEnabled" | "isFree" | "isPlatformEnabled">,
  user?: Pick<IUser, "plan_id">,
): CredentialAuthority {
  if (model.isPlatformEnabled === false && model.isByokEnabled) {
    return "byok";
  }

  const requiresByok = user?.plan_id !== "pro" && !model.isFree && model.isByokEnabled;

  return requiresByok ? "byok" : "platform";
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
  user: Pick<IUser, "plan_id"> | undefined,
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

export function resolveTierAlternateModel(
  models: ModelConfig,
  user: Pick<IUser, "plan_id"> | undefined,
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
  user?: Pick<IUser, "plan_id">,
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
  user?: Pick<IUser, "plan_id">,
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
  user?: Pick<IUser, "plan_id">,
): ResolvedLineupCandidate | null {
  return resolveLineupCandidate(getExecutableModelsForAccount(models, user), references);
}
