import {
  doesModelMatchRouterMode,
  getModelDisplayName,
  getRouterModeFitScore,
  isActiveModel,
  isActiveRouterModel,
  isModelSelectableForAccount,
  isTextInputChatModel,
  type ModelConfig,
  type ModelConfigItem,
  type ModelPolicyReference,
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

function configuredProviderBonus(model: ModelConfigItem): number {
  return model.isByokEnabled ? 1_000 : 0;
}

export function tryResolveDefaultChatModel(
  models: ModelConfig,
  user?: Pick<IUser, "plan_id">,
): { id: string; config: ModelConfigItem } | null {
  const executableModels = getExecutableModelsForAccount(models, user);
  const textModels = Object.entries(executableModels).filter(
    ([, model]) => isActiveRouterModel(model) && isTextInputChatModel(model),
  );
  const preferredMode = user?.plan_id === "pro" ? "pro" : "standard";
  const preferredModels = textModels.filter(([, model]) =>
    doesModelMatchRouterMode(model, preferredMode),
  );
  const candidates = preferredModels.length > 0 ? preferredModels : textModels;
  const selected = candidates.sort(([, left], [, right]) => {
    const leftScore = configuredProviderBonus(left) + getRouterModeFitScore(left, preferredMode);
    const rightScore = configuredProviderBonus(right) + getRouterModeFitScore(right, preferredMode);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return getModelDisplayName(left).localeCompare(getModelDisplayName(right));
  })[0];

  return selected ? { id: selected[0], config: selected[1] } : null;
}

export function resolveDefaultChatModel(
  models: ModelConfig,
  user?: Pick<IUser, "plan_id">,
): { id: string; config: ModelConfigItem } {
  const selected = tryResolveDefaultChatModel(models, user);

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
  references: readonly ModelPolicyReference[],
  user?: Pick<IUser, "plan_id">,
): { id: string; config: ModelConfigItem } | null {
  const executableModels = getExecutableModelsForAccount(models, user);

  for (const reference of references) {
    const directMatch = executableModels[reference.model];

    if (directMatch?.provider === reference.provider) {
      return { id: reference.model, config: directMatch };
    }

    const matchingEntry = Object.entries(executableModels).find(
      ([, model]) =>
        model.provider === reference.provider && model.matchingModel === reference.model,
    );

    if (matchingEntry) {
      return { id: matchingEntry[0], config: matchingEntry[1] };
    }
  }

  return null;
}
