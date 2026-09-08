import {
  getLineupModelsByRuntime,
  isTextInputChatModel,
  type LastModelSelection,
  type ModelConfig,
  type ModelSelectorScope,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import {
  getLastUsedPickerModel,
  getPickerLocationLabel,
  getPickerScopeModels,
} from "../lib/model-picker.js";
import type { ModelRuntimeOption } from "../lib/model-runtime-options.js";

interface ModelPickerCatalogueOptions {
  availableModels: ModelConfig;
  installationId: string;
  modelScope: ModelSelectorScope;
  agentMode: boolean;
  modelProviderFilter?: string;
  featuredOnly: boolean;
  lastSelection?: LastModelSelection | null;
  runtimeOptions: ModelRuntimeOption[];
}

export function useModelPickerCatalogue({
  availableModels,
  installationId,
  modelScope,
  agentMode,
  modelProviderFilter,
  featuredOnly,
  lastSelection,
  runtimeOptions,
}: ModelPickerCatalogueOptions) {
  const isModelListOnlyScope = modelScope !== "default";
  const isTextOnlyScope = modelScope === "text-only";
  const allScopeModels = useMemo(() => {
    const scopedModels = isModelListOnlyScope
      ? getLineupModelsByRuntime(availableModels, "hosted")
      : availableModels;
    const candidates = getPickerScopeModels(
      scopedModels,
      modelScope,
      agentMode,
      modelProviderFilter,
    );

    return Object.fromEntries(
      Object.entries(candidates).filter(
        ([, candidate]) =>
          (!featuredOnly || candidate.isFeatured) &&
          (!isTextOnlyScope || isTextInputChatModel(candidate)),
      ),
    );
  }, [
    availableModels,
    isModelListOnlyScope,
    modelScope,
    agentMode,
    modelProviderFilter,
    featuredOnly,
    isTextOnlyScope,
  ]);
  const recentModels = useMemo(() => {
    if (isModelListOnlyScope) {
      return [];
    }

    return getLastUsedPickerModel(lastSelection, allScopeModels, installationId);
  }, [lastSelection, allScopeModels, isModelListOnlyScope, installationId]);
  const modelLocations = useMemo(
    () => ({
      ...Object.fromEntries(
        Object.entries(availableModels).map(([id, entry]) => [
          id,
          getPickerLocationLabel(entry, runtimeOptions),
        ]),
      ),
      ...(lastSelection?.computeSite === "device" &&
      lastSelection.originInstallationId !== installationId
        ? { [lastSelection.modelId]: "Another device" }
        : {}),
      ...(lastSelection &&
      !availableModels[lastSelection.modelId] &&
      lastSelection.computeSite !== "device"
        ? { [lastSelection.modelId]: lastSelection.locationLabel }
        : {}),
    }),
    [availableModels, runtimeOptions, lastSelection, installationId],
  );

  return { allScopeModels, recentModels, modelLocations };
}
