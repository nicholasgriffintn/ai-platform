import type {
  DiscoveredModel,
  MachineModel,
  MachineRecord,
  ModelConfig,
  ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";

export type DeviceModelSource = () => Promise<ModelConfig>;

let source: DeviceModelSource | null = null;

export function setDeviceModelSource(next: DeviceModelSource | null): void {
  source = next;
}

export function deviceModelSource(): DeviceModelSource | null {
  return source;
}

export function deviceModelId(vendor: string, nativeId: string, machineId?: string): string {
  return machineId ? `machine/${machineId}/${vendor}/${nativeId}` : `${vendor}/${nativeId}`;
}

type DeviceModelDetails = Pick<
  MachineModel,
  "nativeId" | "displayName" | "contextTokens" | "capabilities" | "loaded"
> & {
  parameterSizeBytes?: number | null;
};

export function toDeviceModel(
  vendor: string,
  model: DeviceModelDetails,
  options: { machineId?: string; machineLabel?: string; executable?: boolean } = {},
): ModelConfigItem {
  const id = deviceModelId(vendor, model.nativeId, options.machineId);
  const isRemoteMachine = Boolean(options.machineId);

  return {
    id,
    name: model.displayName,
    matchingModel: model.nativeId,
    provider: vendor,
    runsOn: "device",
    machineId: options.machineId,
    description: isRemoteMachine
      ? `Runs on ${options.machineLabel ?? "another machine"} through ${vendor}.`
      : `Runs on this machine through ${vendor}.`,
    contextWindow: model.contextTokens ?? undefined,
    multimodal: false,
    supportsToolCalls: false,
    supportsAttachments: false,
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    isExecutable: options.executable ?? !isRemoteMachine,
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
      models[deviceModelId(runtime.vendor, model.nativeId)] = {
        ...toDeviceModel(runtime.vendor, model),
        runtimeEndpointId: model.endpointId,
      };
    }
  }

  return models;
}

export function buildMachineModels(machines: readonly MachineRecord[]): ModelConfig {
  const models: ModelConfig = {};

  for (const machine of machines) {
    if (!machine.online) {
      continue;
    }

    for (const runtime of machine.runtimes) {
      if (runtime.kind !== "model" || runtime.readiness.status !== "ready") {
        continue;
      }

      for (const model of runtime.models) {
        const id = deviceModelId(runtime.vendor, model.nativeId, machine.machineId);

        models[id] = toDeviceModel(runtime.vendor, model, {
          machineId: machine.machineId,
          machineLabel: machine.label,
          executable: machine.capabilities.includes("model-relay"),
        });
      }
    }
  }

  return models;
}
