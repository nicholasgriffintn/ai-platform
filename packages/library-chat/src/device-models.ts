import type {
  DiscoveredModel,
  MachineModel,
  MachineRecord,
  ModelConfig,
  ModelConfigItem,
  Readiness,
} from "@ngriffin_uk/polychat-schemas";
import { agentModelConfig, READINESS_PROTOCOL_VERSION } from "@ngriffin_uk/polychat-schemas";

const MACHINE_OFFLINE_READINESS_TTL_MS = 24 * 60 * 60 * 1000;

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
  options: {
    machineId?: string;
    machineLabel?: string;
    executable?: boolean;
    readiness?: Readiness;
  } = {},
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
    ...(options.readiness ? { readiness: options.readiness } : {}),
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

function machineOfflineReadiness(machine: MachineRecord, now: Date): Readiness {
  return {
    protocolVersion: READINESS_PROTOCOL_VERSION,
    state: "unavailable",
    reasonCode: "machine_offline",
    reason: `${machine.label} is offline. Open Polychat on it to carry on with this model.`,
    checkedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + MACHINE_OFFLINE_READINESS_TTL_MS).toISOString(),
  };
}

export function buildMachineModels(
  machines: readonly MachineRecord[],
  now = new Date(),
): ModelConfig {
  const models: ModelConfig = {};

  for (const machine of machines) {
    const offline = machine.online ? undefined : machineOfflineReadiness(machine, now);

    for (const runtime of machine.runtimes) {
      if (runtime.kind === "local-tools") {
        continue;
      }

      if (runtime.kind === "agent") {
        if (runtime.readiness.state !== "ready" || !runtime.supportsSessions) {
          continue;
        }

        const base = agentModelConfig[`agent/${runtime.vendor}`];

        if (!base) {
          continue;
        }

        const id = deviceModelId(runtime.vendor, runtime.vendor, machine.machineId);

        models[id] = {
          ...base,
          id,
          machineId: machine.machineId,
          description: `Runs on ${machine.label} through ${base.name ?? runtime.vendor}.`,
          isExecutable: !offline && machine.capabilities.includes("agent-run"),
          ...(offline ? { readiness: offline } : {}),
        };

        continue;
      }

      if (runtime.readiness.status !== "ready") {
        continue;
      }

      for (const model of runtime.models) {
        const id = deviceModelId(runtime.vendor, model.nativeId, machine.machineId);

        models[id] = toDeviceModel(runtime.vendor, model, {
          machineId: machine.machineId,
          machineLabel: machine.label,
          executable: !offline && machine.capabilities.includes("model-relay"),
          readiness: offline,
        });
      }
    }
  }

  return models;
}
