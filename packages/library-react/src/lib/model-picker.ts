import { getNotificationInstallationId } from "@ngriffin_uk/polychat-library-client";
import {
  COMPUTE_SITES,
  getChatAndRealtimeModelsByMode,
  getModelsByMode,
  getRealtimeSessionModelsByProvider,
  getToolCallModels,
  type ComputeSite,
  type LastModelSelection,
  type ModelCatalogItem,
  type ModelConfig,
  type ModelConfigItem,
  type ModelSelectorScope,
} from "@ngriffin_uk/polychat-schemas";

import type { ModelRuntimeOption } from "./model-runtime-options.js";

export function getPickerInstallationId(): string {
  try {
    return getNotificationInstallationId();
  } catch {
    return "";
  }
}

export function getPickerModelSite(model: ModelConfigItem): ComputeSite {
  return model.machineId
    ? "machine"
    : model.provider === "web-llm"
      ? "browser"
      : model.runsOn === "device"
        ? "device"
        : "hosted";
}

export function getPickerLocationLabel(
  model: ModelConfigItem,
  options: ModelRuntimeOption[],
): string {
  const site = getPickerModelSite(model);

  return (
    options.find(
      (option) =>
        option.site === site && (site !== "machine" || option.machineId === model.machineId),
    )?.label ??
    (site === "machine"
      ? "Unavailable device"
      : site === "browser"
        ? "This browser"
        : site === "device"
          ? "This device"
          : "Cloud")
  );
}

export function getPickerScopeModels(
  models: ModelConfig,
  scope: ModelSelectorScope,
  agentMode: boolean,
  provider?: string,
): ModelConfig {
  if (scope === "live") {
    return getRealtimeSessionModelsByProvider(models, provider);
  }

  if (scope === "default" && agentMode) {
    return getToolCallModels(models);
  }

  return Object.assign(
    {},
    ...COMPUTE_SITES.map((site) =>
      scope === "chat-and-live"
        ? getChatAndRealtimeModelsByMode(models, site)
        : getModelsByMode(models, site),
    ),
  );
}

export function getLastUsedPickerModel(
  selection: LastModelSelection | null | undefined,
  models: ModelConfig,
  installationId?: string,
): ModelCatalogItem[] {
  if (!selection) {
    return [];
  }

  const model = models[selection.modelId];

  if (
    model &&
    getPickerModelSite(model) === selection.computeSite &&
    model.machineId === selection.machineId &&
    (selection.computeSite !== "device" ||
      Boolean(selection.originInstallationId && selection.originInstallationId === installationId))
  ) {
    return [{ ...model, id: selection.modelId }];
  }

  return [
    {
      id: selection.modelId,
      matchingModel: selection.modelId,
      name: selection.name,
      provider: selection.provider ?? "unknown",
      machineId: selection.machineId,
      runsOn:
        selection.computeSite === "machine" || selection.computeSite === "device"
          ? "device"
          : undefined,
      description: "This model or location is currently unavailable.",
      isExecutable: false,
    },
  ];
}
