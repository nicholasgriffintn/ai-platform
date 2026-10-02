import { ProviderLibrary } from "@ngriffin_uk/polychat-ai-providers";
import type {
  HostManifest,
  ModelProviderId,
  ProviderManifest,
  TrainerManifest,
} from "@ngriffin_uk/polychat-schemas";

import { BedrockHost, BedrockTrainer } from "./aws/bedrock.js";
import { AwsConnectionChecker } from "./aws/checker.js";
import { AWS_MANIFEST } from "./aws/manifest.js";
import { SageMakerHost, SageMakerTrainer } from "./aws/sagemaker.js";
import {
  AZURE_FOUNDRY_MANIFEST,
  AzureConnectionChecker,
  AzureFoundryHost,
} from "./azure/foundry.js";
import {
  CLOUDFLARE_WORKERS_AI_MANIFEST,
  WorkersAiConnectionChecker,
  WorkersAiHost,
} from "./cloudflare/workers-ai.js";
import { unsupported } from "./errors.js";
import {
  FIREWORKS_MANIFEST,
  FireworksConnectionChecker,
  FireworksHost,
  FireworksTrainer,
} from "./fireworks/fireworks.js";
import {
  GOOGLE_VERTEX_MANIFEST,
  VertexConnectionChecker,
  VertexHost,
  VertexTrainer,
} from "./google/vertex.js";
import { HuggingFaceEndpointsHost } from "./huggingface/endpoints.js";
import { HuggingFaceConnectionChecker, HuggingFaceInferenceHost } from "./huggingface/inference.js";
import { HuggingFaceJobsTrainer } from "./huggingface/jobs.js";
import { HUGGINGFACE_MANIFEST } from "./huggingface/manifest.js";
import {
  NEBIUS_MANIFEST,
  NebiusConnectionChecker,
  NebiusHost,
  NebiusTrainer,
} from "./nebius/nebius.js";
import {
  ExternalConnectionChecker,
  ExternalHost,
  OPENAI_COMPATIBLE_MANIFEST,
} from "./openai-compatible/external.js";
import { OPENAI_MANIFEST, OpenAIConnectionChecker } from "./openai/connection.js";
import { RUNPOD_MANIFEST, RunPodConnectionChecker, RunPodHost } from "./runpod/runpod.js";
import {
  TOGETHER_MANIFEST,
  TogetherConnectionChecker,
  TogetherHost,
  TogetherTrainer,
} from "./together/together.js";
import type {
  ConnectionChecker,
  Host,
  ModelProviderAdapters,
  ProviderAdapterContext,
  Trainer,
} from "./types.js";

export const MODEL_PROVIDERS: Record<ModelProviderId, ModelProviderAdapters> = {
  openai: {
    manifest: OPENAI_MANIFEST,
    checker: (context) => new OpenAIConnectionChecker(context),
    trainers: {},
    hosts: {},
  },
  huggingface: {
    manifest: HUGGINGFACE_MANIFEST,
    checker: (context) => new HuggingFaceConnectionChecker(context),
    trainers: { "huggingface-jobs": (context) => new HuggingFaceJobsTrainer(context) },
    hosts: {
      "huggingface-endpoints": (context) => new HuggingFaceEndpointsHost(context),
      "huggingface-inference": (context) => new HuggingFaceInferenceHost(context),
    },
  },
  aws: {
    manifest: AWS_MANIFEST,
    checker: (context) => new AwsConnectionChecker(context),
    trainers: {
      "bedrock-customisation": (context) => new BedrockTrainer(context),
      "sagemaker-training": (context) => new SageMakerTrainer(context),
    },
    hosts: {
      bedrock: (context) => new BedrockHost(context),
      sagemaker: (context) => new SageMakerHost(context),
    },
  },
  together: {
    manifest: TOGETHER_MANIFEST,
    checker: (context) => new TogetherConnectionChecker(context),
    trainers: { "together-fine-tuning": (context) => new TogetherTrainer(context) },
    hosts: { together: (context) => new TogetherHost(context) },
  },
  fireworks: {
    manifest: FIREWORKS_MANIFEST,
    checker: (context) => new FireworksConnectionChecker(context),
    trainers: { "fireworks-fine-tuning": (context) => new FireworksTrainer(context) },
    hosts: { fireworks: (context) => new FireworksHost(context) },
  },
  nebius: {
    manifest: NEBIUS_MANIFEST,
    checker: (context) => new NebiusConnectionChecker(context),
    trainers: { "nebius-fine-tuning": (context) => new NebiusTrainer(context) },
    hosts: { nebius: (context) => new NebiusHost(context) },
  },
  "google-vertex": {
    manifest: GOOGLE_VERTEX_MANIFEST,
    checker: (context) => new VertexConnectionChecker(context),
    trainers: { "vertex-custom-job": (context) => new VertexTrainer(context) },
    hosts: { vertex: (context) => new VertexHost(context) },
  },
  "azure-foundry": {
    manifest: AZURE_FOUNDRY_MANIFEST,
    checker: (context) => new AzureConnectionChecker(context),
    trainers: {},
    hosts: { "azure-managed-online": (context) => new AzureFoundryHost(context) },
  },
  runpod: {
    manifest: RUNPOD_MANIFEST,
    checker: (context) => new RunPodConnectionChecker(context),
    trainers: {},
    hosts: { "runpod-serverless": (context) => new RunPodHost(context) },
  },
  "cloudflare-workers-ai": {
    manifest: CLOUDFLARE_WORKERS_AI_MANIFEST,
    checker: (context) => new WorkersAiConnectionChecker(context),
    trainers: {},
    hosts: { "workers-ai-lora": (context) => new WorkersAiHost(context) },
  },
  "openai-compatible": {
    manifest: OPENAI_COMPATIBLE_MANIFEST,
    checker: (context) => new ExternalConnectionChecker(context),
    trainers: {},
    hosts: { "openai-compatible": (context) => new ExternalHost(context) },
  },
};

type ModelProviderCategories = {
  trainer: Trainer;
  host: Host;
  checker: ConnectionChecker;
};

export function adapterName(provider: ModelProviderId, target: string): string {
  return `${provider}:${target}`;
}

export const modelProviderLibrary = new ProviderLibrary<
  ModelProviderCategories,
  ProviderAdapterContext
>({
  bootstrappers: {
    trainer: [
      (registry) => {
        for (const [provider, adapters] of Object.entries(MODEL_PROVIDERS) as Array<
          [ModelProviderId, ModelProviderAdapters]
        >) {
          for (const [target, create] of Object.entries(adapters.trainers)) {
            registry.register("trainer", {
              name: adapterName(provider, target),
              lifecycle: "transient",
              metadata: { vendor: adapters.manifest.vendor, categories: ["training"] },
              create,
            });
          }
        }
      },
    ],
    host: [
      (registry) => {
        for (const [provider, adapters] of Object.entries(MODEL_PROVIDERS) as Array<
          [ModelProviderId, ModelProviderAdapters]
        >) {
          for (const [target, create] of Object.entries(adapters.hosts)) {
            registry.register("host", {
              name: adapterName(provider, target),
              lifecycle: "transient",
              metadata: { vendor: adapters.manifest.vendor, categories: ["hosting"] },
              create,
            });
          }
        }
      },
    ],
    checker: [
      (registry) => {
        for (const [provider, adapters] of Object.entries(MODEL_PROVIDERS) as Array<
          [ModelProviderId, ModelProviderAdapters]
        >) {
          registry.register("checker", {
            name: provider,
            lifecycle: "transient",
            metadata: { vendor: adapters.manifest.vendor, categories: ["connection"] },
            create: adapters.checker,
          });
        }
      },
    ],
  },
});

export function listProviderManifests(): ProviderManifest[] {
  return Object.values(MODEL_PROVIDERS).map((adapters) => adapters.manifest);
}

export function providerManifest(provider: ModelProviderId): ProviderManifest {
  return MODEL_PROVIDERS[provider].manifest;
}

export function trainerManifest(provider: ModelProviderId, target: string): TrainerManifest {
  const manifest = MODEL_PROVIDERS[provider].manifest.trainers.find((item) => item.id === target);

  if (!manifest) {
    throw unsupported(`${provider} has no trainer called ${target}`);
  }

  return manifest;
}

export function hostManifest(provider: ModelProviderId, target: string): HostManifest {
  const manifest = MODEL_PROVIDERS[provider].manifest.hosts.find((item) => item.id === target);

  if (!manifest) {
    throw unsupported(`${provider} has no host called ${target}`);
  }

  return manifest;
}

export function createTrainer(
  provider: ModelProviderId,
  target: string,
  context: ProviderAdapterContext,
): Trainer {
  trainerManifest(provider, target);

  return modelProviderLibrary.resolve("trainer", adapterName(provider, target), context);
}

export function createHost(
  provider: ModelProviderId,
  target: string,
  context: ProviderAdapterContext,
): Host {
  hostManifest(provider, target);

  return modelProviderLibrary.resolve("host", adapterName(provider, target), context);
}

export function createConnectionChecker(
  provider: ModelProviderId,
  context: ProviderAdapterContext,
): ConnectionChecker {
  return modelProviderLibrary.resolve("checker", provider, context);
}
