import type {
  Adaptation,
  ConnectionCapabilities,
  DatasetShape,
  DeploymentOption,
  DeploymentShape,
  GraderKind,
  HardwareOption,
  HostManifest,
  ModelProviderId,
  PolicyVerdict,
  ProviderManifest,
  RegionOption,
  SizingEstimate,
  TrainerManifest,
  TrainerOption,
  TrainingMethod,
} from "@ngriffin_uk/polychat-schemas";
import { formatBytes, formatParameterCount } from "@ngriffin_uk/polychat-utility-core";

import { estimateTrainingCost } from "./costs.js";
import { smallestFittingHardware } from "./sizing.js";

export type WeightsPlacement =
  | { kind: "hub"; repo: string }
  | { kind: "provider"; provider: ModelProviderId }
  | { kind: "url" };

export interface ResolverModel {
  kind: "model" | "adapter";
  placement: WeightsPlacement;
  modelType: string | null;
  parameterCount: number | null;
}

export interface ResolverConnection {
  provider: ModelProviderId;
  capabilities: ConnectionCapabilities;
}

export interface RouteCandidate {
  provider: ModelProviderId;
  host: HostManifest;
  region: RegionOption | null;
  shape: DeploymentShape;
}

function connectionFor(
  connections: readonly ResolverConnection[],
  provider: ModelProviderId,
): ResolverConnection | undefined {
  return connections.find((connection) => connection.provider === provider);
}

function supportsArchitecture(architectures: readonly string[], modelType: string | null): boolean {
  return architectures.includes("*") || (modelType !== null && architectures.includes(modelType));
}

function weightReasons(
  provider: ModelProviderId,
  host: HostManifest,
  model: ResolverModel,
  catalogue: ReadonlySet<string>,
): string[] {
  const { placement } = model;

  if (host.weights === "external") {
    return [];
  }

  if (placement.kind === "provider") {
    return placement.provider === provider ? [] : [`Weights live with ${placement.provider}`];
  }

  if (placement.kind === "url") {
    return host.weights === "hub" && provider === "aws" ? [] : ["Weights are not on the Hub"];
  }

  if (host.weights === "catalogue" && !catalogue.has(`${provider}:${placement.repo}`)) {
    return ["Only models the provider already serves"];
  }

  return [];
}

export function resolveDeploymentOptions({
  manifests,
  connections,
  model,
  adapters,
  sizing,
  catalogue = new Set(),
  verdictFor,
}: {
  manifests: readonly ProviderManifest[];
  connections: readonly ResolverConnection[];
  model: ResolverModel;
  adapters: readonly ResolverModel[];
  sizing: SizingEstimate | null;
  catalogue?: ReadonlySet<string>;
  verdictFor: (candidate: RouteCandidate) => PolicyVerdict;
}): DeploymentOption[] {
  const options: DeploymentOption[] = [];

  for (const manifest of manifests) {
    const connection = connectionFor(connections, manifest.id);

    for (const host of manifest.hosts) {
      const reasons = [
        ...weightReasons(manifest.id, host, model, catalogue),
        ...adapters.flatMap((adapter) => weightReasons(manifest.id, host, adapter, catalogue)),
      ];

      if (adapters.length > 0 && !host.adapters) {
        reasons.push("Cannot load adapters; merge them into the base first");
      }

      if (!supportsArchitecture(host.architectures, model.modelType)) {
        reasons.push(`Does not serve ${model.modelType ?? "this"} architecture`);
      }

      if (
        host.maxParameters !== null &&
        model.parameterCount !== null &&
        model.parameterCount > host.maxParameters
      ) {
        reasons.push(`Limited to ${formatParameterCount(host.maxParameters)} parameters`);
      }

      const hardware = host.hardware.length ? smallestFittingHardware(sizing, host.hardware) : null;

      if (host.hardware.length > 0 && hardware === null && sizing !== null) {
        reasons.push(`Needs more than the largest option (${formatBytes(sizing.totalBytes)})`);
      }

      for (const shape of host.shapes) {
        for (const region of host.regions.length ? host.regions : [null]) {
          const candidate = { provider: manifest.id, host, region, shape };

          options.push({
            provider: manifest.id,
            providerName: manifest.name,
            host: host.id,
            hostName: host.name,
            shape,
            region,
            hardware,
            fits: reasons.length === 0,
            reasons,
            hourlyUsd: hardware?.hourlyUsd ?? null,
            perMillionTokensUsd: host.pricing.unit === "million_tokens" ? host.pricing.usd : null,
            scaleToZero: host.scaleToZero,
            weightsVerified: host.weightsVerified,
            retention: host.retention,
            connected: Boolean(connection?.capabilities.host),
            verdict: verdictFor(candidate),
            engines: host.engines,
            quantisations: host.quantisations,
          });
        }
      }
    }
  }

  return options.sort((left, right) => rankOption(left) - rankOption(right));
}

function rankOption(option: DeploymentOption): number {
  const effectRank = { allow: 0, warn: 1, review: 2, block: 3 }[option.verdict.effect];

  return (
    (option.fits ? 0 : 1000) +
    (option.connected ? 0 : 100) +
    effectRank * 10 +
    Math.min(9, Math.floor((option.hourlyUsd ?? 5) / 2))
  );
}

const TRAINING_BYTES_PER_PARAMETER: Record<Adaptation, number> = {
  lora: 2.4,
  qlora: 0.9,
  full: 18,
};

export function trainingMemoryBytes(
  parameterCount: number | null,
  adaptation: Adaptation,
): number | null {
  return parameterCount === null
    ? null
    : parameterCount * TRAINING_BYTES_PER_PARAMETER[adaptation] + 4 * 1024 ** 3;
}

function trainingHardware(trainer: TrainerManifest, memoryBytes: number | null): HardwareOption[] {
  if (memoryBytes === null) {
    return trainer.hardware;
  }

  return trainer.hardware.filter((option) => option.memoryGb * 1024 ** 3 * 0.9 >= memoryBytes);
}

export function resolveTrainerOptions({
  manifests,
  connections,
  hubConnected,
  method,
  adaptation,
  base,
  datasetShape,
  graderKind,
  tokens,
}: {
  manifests: readonly ProviderManifest[];
  connections: readonly ResolverConnection[];
  hubConnected: boolean;
  method: TrainingMethod;
  adaptation: Adaptation;
  base: ResolverModel & { repo: string | null };
  datasetShape: DatasetShape | null;
  graderKind: GraderKind | null;
  tokens: number;
}): TrainerOption[] {
  const memory = trainingMemoryBytes(base.parameterCount, adaptation);
  const options: TrainerOption[] = [];

  for (const manifest of manifests) {
    const connection = connectionFor(connections, manifest.id);

    for (const trainer of manifest.trainers) {
      const reasons: string[] = [];

      if (!trainer.methods.includes(method)) {
        reasons.push(`Does not offer ${method.replace(/_/g, " ")}`);
      }

      if (!trainer.adaptations.includes(adaptation)) {
        reasons.push(`Does not offer ${adaptation} training`);
      }

      if (datasetShape && !trainer.datasetShapes.includes(datasetShape)) {
        reasons.push(`Does not accept ${datasetShape.replace(/_/g, " ")} datasets`);
      }

      if (method === "rft" && graderKind && !trainer.graderKinds.includes(graderKind)) {
        reasons.push(`Cannot use ${graderKind} graders as a reward`);
      }

      if (
        trainer.bases.kind === "catalogue" &&
        (base.repo === null || !trainer.bases.models.includes(base.repo))
      ) {
        reasons.push("Base is not on the provider's tuning list");
      }

      if (
        base.placement.kind !== "hub" &&
        !(base.placement.kind === "provider" && base.placement.provider === manifest.id)
      ) {
        reasons.push("Base weights are not on the Hub");
      }

      if (
        trainer.bases.maxParameters !== null &&
        base.parameterCount !== null &&
        base.parameterCount > trainer.bases.maxParameters
      ) {
        reasons.push(`Limited to ${formatParameterCount(trainer.bases.maxParameters)} parameters`);
      }

      if (trainer.output === "hub" && !hubConnected && manifest.id !== "huggingface") {
        reasons.push("Connect Hugging Face so results land in your organisation");
      }

      const hardware = trainingHardware(trainer, memory);

      if (trainer.hardware.length > 0 && hardware.length === 0) {
        reasons.push(`Needs more than ${formatBytes(memory ?? 0)} of GPU memory`);
      }

      const cheapest =
        [...hardware].sort(
          (left, right) =>
            (left.hourlyUsd ?? Number.POSITIVE_INFINITY) -
            (right.hourlyUsd ?? Number.POSITIVE_INFINITY),
        )[0] ?? null;

      options.push({
        provider: manifest.id,
        providerName: manifest.name,
        trainer: trainer.id,
        trainerName: trainer.name,
        connected: Boolean(connection?.capabilities.train),
        supported: reasons.length === 0,
        reasons,
        hardware,
        regions: trainer.regions,
        estimate: estimateTrainingCost({
          trainer,
          hardware: cheapest,
          parameterCount: base.parameterCount,
          tokens,
          adaptation,
          method,
        }),
        output: trainer.output,
      });
    }
  }

  return options.sort(
    (left, right) =>
      Number(!left.supported) - Number(!right.supported) ||
      Number(!left.connected) - Number(!right.connected) ||
      (left.estimate.usd ?? Number.POSITIVE_INFINITY) -
        (right.estimate.usd ?? Number.POSITIVE_INFINITY),
  );
}
