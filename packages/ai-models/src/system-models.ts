import {
  findModelByReference,
  getSystemModelLineup,
  isActiveModel,
  isLineupEligibleModel,
  modelHasInputModalities,
  modelHasOutputModality,
  resolveLineupCandidates,
  type ModelConfig,
  type ModelConfigItem,
  type ModelLineupCandidate,
  type ResolvedLineupCandidate,
  type SystemModelActiveSource,
  type SystemModelChoice,
  type SystemModelChoices,
  type SystemModelChoiceStatus,
  type SystemModelRequirement,
  type SystemModelRole,
} from "@ngriffin_uk/polychat-schemas";

import { getExecutableModelsForAccount } from "./policy.js";
import type { AccountPlan } from "./types.js";

export function meetsSystemModelRequirement(
  requirement: SystemModelRequirement,
  model: ModelConfigItem,
): boolean {
  if (!isActiveModel(model)) {
    return false;
  }

  switch (requirement.kind) {
    case "text":
      return (
        isLineupEligibleModel(model) &&
        modelHasInputModalities(model, requirement.inputs ?? []) &&
        (!requirement.providers || requirement.providers.includes(model.provider))
      );
    case "output":
      return (
        modelHasOutputModality(model, requirement.output) &&
        modelHasInputModalities(model, requirement.inputs ?? []) &&
        (requirement.strengths ?? []).every((strength) => model.strengths?.includes(strength)) &&
        (!requirement.providers || requirement.providers.includes(model.provider))
      );
    case "capability":
      return Boolean(model[requirement.capability]);
    case "anyOf":
      return requirement.options.some((option) => meetsSystemModelRequirement(option, model));
    default:
      return false;
  }
}

export function isSystemRoleModel(role: SystemModelRole, model: ModelConfigItem): boolean {
  return meetsSystemModelRequirement(getSystemModelLineup(role).requires, model);
}

export function filterSystemRoleModels(models: ModelConfig, role: SystemModelRole): ModelConfig {
  return Object.fromEntries(
    Object.entries(models).filter(([, model]) => isSystemRoleModel(role, model)),
  );
}

export interface SystemModelLayers {
  workspace?: SystemModelChoices | null;
  user?: SystemModelChoices | null;
}

export interface SystemModelLayer {
  source: SystemModelActiveSource;
  candidates: readonly ModelLineupCandidate[];
}

export function listSystemModelLayers(
  role: SystemModelRole,
  layers: SystemModelLayers = {},
): SystemModelLayer[] {
  return [
    { source: "workspace" as const, candidates: layers.workspace?.[role] ?? [] },
    { source: "user" as const, candidates: layers.user?.[role] ?? [] },
    { source: "platform" as const, candidates: getSystemModelLineup(role).defaults },
  ].filter((layer) => layer.candidates.length > 0);
}

export interface ResolvedSystemRoleModel extends ResolvedLineupCandidate {
  source: SystemModelActiveSource;
}

export function resolveSystemRoleModel(
  models: ModelConfig,
  role: SystemModelRole,
  layers: SystemModelLayers = {},
  user?: AccountPlan,
): ResolvedSystemRoleModel | null {
  return resolveSystemRoleModels(models, role, layers, user)[0] ?? null;
}

export function resolveSystemRoleModels(
  models: ModelConfig,
  role: SystemModelRole,
  layers: SystemModelLayers = {},
  user?: AccountPlan,
): ResolvedSystemRoleModel[] {
  const eligible = filterSystemRoleModels(getExecutableModelsForAccount(models, user), role);
  const seen = new Set<string>();

  return listSystemModelLayers(role, layers).flatMap((layer) =>
    resolveLineupCandidates(eligible, layer.candidates).flatMap((selected) => {
      if (seen.has(selected.id)) {
        return [];
      }

      seen.add(selected.id);

      return [{ ...selected, source: layer.source }];
    }),
  );
}

export function readSystemModelChoiceStatus(
  choice: SystemModelChoice,
  catalogue: ModelConfig,
  accessible: ModelConfig,
): SystemModelChoiceStatus {
  const listed = findModelByReference(catalogue, choice);

  if (!listed || !isActiveModel(listed.config)) {
    return "retired";
  }

  return findModelByReference(accessible, choice) ? "ready" : "unavailable";
}
