import {
  agentModelConfig,
  isMachineOnline,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";

import { parseMachineModelId } from "~/modules/machines/domain/model-id";
import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import type { ModelLookup, ModelSource } from "~/modules/models/application/sources";

async function findMachineModel(
  modelId: string,
  { env, userId, provider }: ModelLookup,
): Promise<ModelConfigItem | null> {
  const reference = parseMachineModelId(modelId);

  if (!env?.DB || !userId || !reference || (provider && provider !== reference.vendor)) {
    return null;
  }

  const { machineId, vendor: runtimeVendor, nativeId } = reference;

  const machine = await new MachineRepository(env).findAccessible(userId, machineId);

  if (!machine || !isMachineOnline(machine)) {
    return null;
  }

  for (const runtime of machine.runtimes) {
    if (runtime.kind === "local-tools" || runtime.vendor !== runtimeVendor) {
      continue;
    }

    if (runtime.kind === "agent") {
      const base = agentModelConfig[`agent/${runtime.vendor}`];

      if (
        nativeId !== runtime.vendor ||
        runtime.readiness.state !== "ready" ||
        !runtime.supportsSessions ||
        !machine.capabilities.includes("agent-run") ||
        !base
      ) {
        continue;
      }

      return {
        ...base,
        id: modelId,
        matchingModel: modelId,
        machineId,
        isExecutable: true,
        description: `Runs on ${machine.label} through ${base.name ?? runtime.vendor}.`,
      };
    }

    const model = runtime.models.find((candidate) => candidate.nativeId === nativeId);

    if (
      runtime.readiness.status !== "ready" ||
      !machine.capabilities.includes("model-relay") ||
      !model
    ) {
      continue;
    }

    return {
      id: modelId,
      name: model.displayName,
      matchingModel: modelId,
      provider: runtime.vendor,
      runsOn: "device",
      machineId,
      description: `Runs on ${machine.label} through ${runtime.vendor}.`,
      contextWindow: model.contextTokens ?? undefined,
      multimodal: false,
      supportsToolCalls: false,
      supportsAttachments: false,
      modalities: { input: ["text"], output: ["text"] },
      isExecutable: true,
      isFeatured: false,
      isPlatformEnabled: true,
    };
  }

  return null;
}

export const machineModelSource: ModelSource = { find: findMachineModel };
