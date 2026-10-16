import {
  agentModelConfig,
  isMachineOnline,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";

import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import type { ModelLookup, ModelSource } from "~/modules/models/application/sources";

async function findMachineModel(
  modelId: string,
  { env, userId, provider }: ModelLookup,
): Promise<ModelConfigItem | null> {
  if (!env?.DB || !userId || !modelId.startsWith("machine/")) {
    return null;
  }

  const [, machineId, runtimeVendor, ...nativeIdParts] = modelId.split("/");
  const nativeId = nativeIdParts.join("/");

  if (!machineId || !runtimeVendor || !nativeId || (provider && provider !== runtimeVendor)) {
    return null;
  }

  const machine = (await new MachineRepository(env).listForUser(userId)).find(
    (candidate) => candidate.machineId === machineId && isMachineOnline(candidate),
  );

  if (!machine) {
    return null;
  }

  for (const runtime of machine.runtimes) {
    if (runtime.vendor !== runtimeVendor) {
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
      matchingModel: model.nativeId,
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
