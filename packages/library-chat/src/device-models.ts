import type { DiscoveredModel, ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export type DeviceModelSource = () => Promise<ModelConfig>;

let source: DeviceModelSource | null = null;

export function setDeviceModelSource(next: DeviceModelSource): void {
  source = next;
}

export function deviceModelSource(): DeviceModelSource | null {
  return source;
}

export function deviceModelId(vendor: string, nativeId: string): string {
  return `${vendor}/${nativeId}`;
}

export function toDeviceModel(vendor: string, model: DiscoveredModel): ModelConfigItem {
  const id = deviceModelId(vendor, model.nativeId);

  return {
    id,
    name: model.displayName,
    matchingModel: model.nativeId,
    provider: vendor,
    runsOn: "device",
    description: `Runs on this machine through ${vendor}.`,
    contextWindow: model.contextTokens ?? undefined,
    multimodal: model.capabilities.vision,
    supportsToolCalls: model.capabilities.tools,
    supportsAttachments: model.capabilities.vision,
    modalities: {
      input: model.capabilities.vision ? ["text", "image"] : ["text"],
      output: ["text"],
    },
    isExecutable: true,
    isFeatured: false,
    isPlatformEnabled: true,
  };
}

export function buildDeviceModels(
  discovered: readonly { vendor: string; models: readonly DiscoveredModel[] }[],
): ModelConfig {
  const models: ModelConfig = {};

  for (const runtime of discovered) {
    for (const model of runtime.models) {
      models[deviceModelId(runtime.vendor, model.nativeId)] = toDeviceModel(runtime.vendor, model);
    }
  }

  return models;
}
