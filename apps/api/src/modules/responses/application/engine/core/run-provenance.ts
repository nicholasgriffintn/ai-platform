import {
  createRunProvenance,
  isBrowserModel,
  runsOnDevice,
  type ComputeSite,
  type ModelConfigItem,
  type RunProvenance,
} from "@ngriffin_uk/polychat-schemas";

export function resolveRunProvenance(input: {
  requestedSite?: ComputeSite;
  model: string;
  provider: string;
  modelConfig?: ModelConfigItem | null;
}): RunProvenance {
  const inferredSite: ComputeSite = input.modelConfig?.machineId
    ? "machine"
    : isBrowserModel(input.modelConfig ?? { provider: input.provider })
      ? "browser"
      : runsOnDevice(input.modelConfig ?? {})
        ? "device"
        : "hosted";
  const site =
    input.requestedSite && input.requestedSite !== "hosted" ? input.requestedSite : inferredSite;
  const model = input.modelConfig?.matchingModel ?? input.model;
  const vendor = input.modelConfig?.provider ?? input.provider;

  return createRunProvenance({
    site,
    model,
    vendor,
    ...(input.modelConfig?.machineId ? { machineId: input.modelConfig.machineId } : {}),
  });
}
