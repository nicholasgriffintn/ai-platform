import type {
  ConnectionCheck,
  DeploymentStatus,
  HardwareOption,
  HostManifest,
  ProviderManifest,
  RegionOption,
  TrainerManifest,
  TrainingRunStatus,
} from "@ngriffin_uk/polychat-schemas";
import {
  epochSecondsToIso,
  readArray,
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import { misconfigured, unsupported } from "../errors.js";
import { bearer, JsonHttpClient } from "../http.js";
import { invokeOpenAiCompatible, uploadOpenAiStyleFile } from "../openai-compatible.js";
import { hubWeights } from "../training/payload.js";
import type {
  ChatInvocation,
  ChatInvocationResult,
  ConnectionChecker,
  DatasetHandle,
  Host,
  HostDeploymentInput,
  HostDeploymentState,
  HostedDeployment,
  ProviderAdapterContext,
  Trainer,
  TrainingJobState,
  TrainingSubmission,
} from "../types.js";

export const NEBIUS_API = "https://api.tokenfactory.nebius.com";

export const NEBIUS_REGIONS: RegionOption[] = [
  { id: "eu-north1", label: "Finland", jurisdiction: "eu" },
  { id: "eu-west1", label: "France", jurisdiction: "eu" },
  { id: "uk-south1", label: "United Kingdom", jurisdiction: "uk" },
  { id: "us-central1", label: "US Central", jurisdiction: "us" },
  { id: "me-west1", label: "Israel", jurisdiction: "me" },
];

export const NEBIUS_HARDWARE: HardwareOption[] = [
  {
    id: "gpu-l40s-d:1",
    label: "L40S (48 GB)",
    accelerator: "nvidia-l40s",
    count: 1,
    memoryGb: 48,
    hourlyUsd: 1.55,
  },
  {
    id: "gpu-h100-sxm:1",
    label: "H100 (80 GB)",
    accelerator: "nvidia-h100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 2.95,
  },
  {
    id: "gpu-h100-sxm:2",
    label: "2× H100 (160 GB)",
    accelerator: "nvidia-h100",
    count: 2,
    memoryGb: 160,
    hourlyUsd: 5.9,
  },
  {
    id: "gpu-h200-sxm:1",
    label: "H200 (141 GB)",
    accelerator: "nvidia-h200",
    count: 1,
    memoryGb: 141,
    hourlyUsd: 3.5,
  },
  {
    id: "gpu-h200-sxm:8",
    label: "8× H200 (1128 GB)",
    accelerator: "nvidia-h200",
    count: 8,
    memoryGb: 1128,
    hourlyUsd: 28,
  },
  {
    id: "gpu-b200-sxm:1",
    label: "B200 (180 GB)",
    accelerator: "nvidia-b200",
    count: 1,
    memoryGb: 180,
    hourlyUsd: 5.5,
  },
];

export const NEBIUS_TRAINER: TrainerManifest = {
  id: "nebius-fine-tuning",
  name: "Nebius fine-tuning",
  description:
    "LoRA or full supervised fine-tuning with zero retention, exporting checkpoints straight to your Hugging Face organisation.",
  methods: ["sft", "distillation"],
  adaptations: ["lora", "full"],
  datasetShapes: ["messages", "text"],
  graderKinds: [],
  bases: { kind: "hub", models: ["*"], maxParameters: 250_000_000_000 },
  hardware: [],
  regions: NEBIUS_REGIONS.filter((region) => region.jurisdiction === "eu"),
  output: "hub",
  pricing: { unit: "million_tokens", usd: null, note: "Priced per training token by base size" },
};

export const NEBIUS_HOST: HostManifest = {
  id: "nebius",
  name: "Nebius dedicated endpoints",
  description:
    "Dedicated endpoints in Finland, France, the UK or the US with zero-retention inference and a 99.9% SLA.",
  shapes: ["dedicated", "serverless"],
  weights: "catalogue",
  adapters: false,
  scaleToZero: false,
  weightsVerified: true,
  retention: "zero",
  engines: ["provider"],
  quantisations: ["none", "fp8"],
  hardware: NEBIUS_HARDWARE,
  regions: NEBIUS_REGIONS,
  architectures: ["*"],
  maxParameters: null,
  pricing: { unit: "gpu_hour", usd: null, note: "Per GPU hour for each running replica" },
};

export const NEBIUS_MANIFEST: ProviderManifest = {
  id: "nebius",
  name: "Nebius Token Factory",
  vendor: "Nebius",
  description: "EU and UK data residency for fine-tuning and dedicated inference of open models.",
  docsUrl: "https://docs.tokenfactory.nebius.com",
  connection: {
    fields: [
      { key: "apiKey", label: "API key", kind: "secret", required: true },
      { key: "projectId", label: "Project ID", kind: "text", required: false },
    ],
  },
  source: false,
  store: null,
  trainers: [NEBIUS_TRAINER],
  hosts: [NEBIUS_HOST],
};

const JOB_STATUS: Record<string, TrainingRunStatus> = {
  validating_files: "preparing",
  queued: "submitted",
  running: "running",
  succeeded: "completed",
  failed: "failed",
  cancelled: "cancelled",
};

const ENDPOINT_STATUS: Record<string, DeploymentStatus> = {
  starting: "provisioning",
  running: "running",
  updating: "updating",
  stopping: "paused",
  stopped: "paused",
  error: "failed",
};

function nebius(context: ProviderAdapterContext): { http: JsonHttpClient; apiKey: string } {
  const apiKey = context.credentials.secrets.apiKey;

  if (!apiKey) {
    throw misconfigured("The Nebius connection needs an API key");
  }

  return { http: new JsonHttpClient(NEBIUS_API, () => bearer(apiKey), context.fetcher), apiKey };
}

export function nebiusInferenceUrl(region: string | null): string {
  return region ? `https://api.tokenfactory.${region}.nebius.com/v1` : `${NEBIUS_API}/v1`;
}

export class NebiusTrainer implements Trainer {
  readonly manifest = NEBIUS_TRAINER;
  private readonly http: JsonHttpClient;

  constructor(private readonly context: ProviderAdapterContext) {
    this.http = nebius(context).http;
  }

  private upload(dataset: DatasetHandle): Promise<string> {
    return uploadOpenAiStyleFile(
      this.http,
      "/v1/files",
      dataset,
      { purpose: "fine-tune" },
      "Uploading a dataset to Nebius",
    );
  }

  async submit(submission: TrainingSubmission): Promise<TrainingJobState> {
    if (!submission.train) {
      throw unsupported("Nebius fine-tuning needs a training dataset");
    }

    const base = hubWeights(submission.base);
    const hp = submission.spec.hyperparameters;
    const hub = this.context.hub;
    const trainingFile = await this.upload(submission.train);
    const validationFile = submission.validation ? await this.upload(submission.validation) : null;
    const body = await this.http.record("/v1/fine_tuning/jobs", {
      method: "POST",
      body: {
        model: base.repo,
        training_file: trainingFile,
        ...(validationFile ? { validation_file: validationFile } : {}),
        ...(hub
          ? {
              from_checkpoint: {
                type: "hf",
                repo: base.repo,
                revision: base.revision,
                token: hub.token,
              },
            }
          : {}),
        hyperparameters: {
          n_epochs: Math.max(1, Math.round(hp.epochs)),
          learning_rate: hp.learningRate ?? (submission.spec.adaptation === "full" ? 1e-5 : 1e-4),
          batch_size: hp.batchSize,
          warmup_ratio: hp.warmupRatio,
          weight_decay: hp.weightDecay,
          packing: hp.packing,
          context_length: hp.maxSequenceLength,
          lora: submission.spec.adaptation !== "full",
          lora_r: hp.loraRank,
          lora_alpha: hp.loraAlpha,
          lora_dropout: hp.loraDropout,
        },
        seed: hp.seed,
        suffix: slugify(submission.spec.outputName, 60),
        ...(hub
          ? {
              integrations: [
                {
                  type: "hf",
                  hf: { output_repo_name: submission.outputRepository, api_token: hub.token },
                },
              ],
            }
          : {}),
      },
      context: "Starting a Nebius fine-tune",
    });

    return this.toState(body);
  }

  private async toState(body: Record<string, unknown>): Promise<TrainingJobState> {
    const id = readNonEmptyString(body.id) ?? "unknown";
    const status = JOB_STATUS[String(body.status)] ?? "running";
    const exportRepo = readArray(body.integrations)
      .map((item) => readNonEmptyString(readRecord(readRecord(item).hf).output_repo_name))
      .find(Boolean);
    const checkpoints = id === "unknown" ? [] : await this.checkpoints(id);

    return {
      status,
      providerJobId: id,
      metrics: checkpoints.map((checkpoint) => ({
        step: checkpoint.step,
        epoch: null,
        trainLoss: checkpoint.metrics.trainLoss ?? null,
        validLoss: checkpoint.metrics.validLoss ?? null,
        reward: null,
        learningRate: null,
      })),
      checkpoints: checkpoints.map((checkpoint) => ({
        step: checkpoint.step,
        providerRef: checkpoint.id,
        metrics: checkpoint.metrics,
      })),
      output:
        status !== "completed"
          ? null
          : exportRepo
            ? { kind: "hub", repo: exportRepo, revision: "main" }
            : { kind: "provider", provider: "nebius", ref: id },
      costUsd: null,
      failureReason: readNonEmptyString(readRecord(body.error).message) ?? null,
      startedAt: epochSecondsToIso(body.created_at),
      completedAt: epochSecondsToIso(body.finished_at),
    };
  }

  private async checkpoints(jobId: string) {
    const body = readRecord(
      await this.http.json(`/v1/fine_tuning/jobs/${encodeURIComponent(jobId)}/checkpoints`, {
        context: "Reading Nebius checkpoints",
        allowNotFound: true,
      }),
    );

    return readArray(body.data).map((item) => {
      const record = readRecord(item);
      const metrics = readRecord(record.metrics);
      const values: Record<string, number> = {};

      for (const [key, name] of [
        ["train_loss", "trainLoss"],
        ["valid_loss", "validLoss"],
      ] as const) {
        const value = readFiniteNumber(metrics[key]);

        if (value !== undefined) {
          values[name] = value;
        }
      }

      return {
        id: readNonEmptyString(record.id) ?? "",
        step: Math.round(readFiniteNumber(record.step_number) ?? 0),
        metrics: values,
      };
    });
  }

  async status(providerJobId: string): Promise<TrainingJobState> {
    return this.toState(
      await this.http.record(`/v1/fine_tuning/jobs/${encodeURIComponent(providerJobId)}`, {
        context: "Reading a Nebius fine-tune",
      }),
    );
  }

  async cancel(providerJobId: string): Promise<void> {
    await this.http.json(`/v1/fine_tuning/jobs/${encodeURIComponent(providerJobId)}/cancel`, {
      method: "POST",
      body: {},
      context: "Cancelling a Nebius fine-tune",
    });
  }
}

export class NebiusHost implements Host {
  readonly manifest = NEBIUS_HOST;
  private readonly http: JsonHttpClient;
  private readonly apiKey: string;

  constructor(private readonly context: ProviderAdapterContext) {
    const resolved = nebius(context);

    this.http = resolved.http;
    this.apiKey = resolved.apiKey;
  }

  private projectQuery(): string {
    const projectId = this.context.credentials.config.projectId;

    return projectId ? `?ai_project_id=${encodeURIComponent(projectId)}` : "";
  }

  private toState(body: Record<string, unknown>, hardware: string | null): HostDeploymentState {
    const endpoint = readRecord(body.endpoint ?? body);
    const deployment = readRecord(endpoint.deployment);
    const status =
      endpoint.enabled === false
        ? "paused"
        : (ENDPOINT_STATUS[String(deployment.status)] ?? "provisioning");
    const replicas = readFiniteNumber(deployment.ready_replicas) ?? null;
    const rate = NEBIUS_HARDWARE.find((item) => item.id === hardware)?.hourlyUsd ?? null;
    const id = readNonEmptyString(endpoint.id) ?? "unknown";
    const routingKey = readNonEmptyString(endpoint.routing_key) ?? "";
    const region = readNonEmptyString(endpoint.region) ?? null;

    return {
      status,
      providerRef: `${id}|${routingKey}|${region ?? ""}`,
      region,
      readyReplicas: replicas,
      hourlyUsd: rate !== null && replicas !== null ? rate * replicas : rate,
      failureReason: status === "failed" ? "Nebius reported an endpoint error" : null,
    };
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    if (input.adapters.length > 0) {
      throw unsupported("Nebius endpoints serve one model; merge adapters before deploying");
    }

    const [gpuType, gpuCount] = (input.spec.target.hardware ?? NEBIUS_HARDWARE[1].id).split(":");
    const modelName =
      input.model.weights.kind === "hub"
        ? input.model.weights.repo
        : input.model.weights.kind === "provider"
          ? input.model.weights.ref
          : null;

    if (!modelName) {
      throw unsupported("Nebius deploys catalogue models or custom weights registered with Nebius");
    }

    const body = await this.http.record(`/v0/dedicated_endpoints${this.projectQuery()}`, {
      method: "POST",
      body: {
        name: input.name,
        description: `Polychat deployment ${input.deploymentId}`,
        routing_key: `dedicated/${slugify(input.name, 60)}`,
        model_name: modelName,
        flavor_name:
          typeof input.spec.providerOptions.flavorName === "string"
            ? input.spec.providerOptions.flavorName
            : "base",
        gpu_type: gpuType,
        gpu_count: Number(gpuCount) || 1,
        region: input.spec.target.region ?? NEBIUS_REGIONS[0].id,
        scaling: {
          min_replicas: Math.max(1, input.spec.scaling.minReplicas),
          max_replicas: Math.max(1, input.spec.scaling.maxReplicas),
        },
        ...(typeof input.spec.providerOptions.customWeightsId === "string"
          ? { custom_weights_id: input.spec.providerOptions.customWeightsId }
          : {}),
      },
      context: "Creating a Nebius dedicated endpoint",
    });

    return this.toState(body, input.spec.target.hardware);
  }

  private endpointId(deployment: HostedDeployment): string {
    return deployment.providerRef.split("|")[0];
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const body = await this.http.json(
      `/v0/dedicated_endpoints/${encodeURIComponent(this.endpointId(deployment))}`,
      {
        context: "Reading a Nebius endpoint",
        allowNotFound: true,
      },
    );

    return body === null
      ? {
          status: "deleted",
          providerRef: deployment.providerRef,
          region: null,
          readyReplicas: 0,
          hourlyUsd: 0,
          failureReason: null,
        }
      : this.toState(readRecord(body), deployment.spec.target.hardware);
  }

  private async patch(
    deployment: HostedDeployment,
    body: Record<string, unknown>,
  ): Promise<HostDeploymentState> {
    await this.http.json(
      `/v0/dedicated_endpoints/${encodeURIComponent(this.endpointId(deployment))}`,
      {
        method: "PATCH",
        body,
        context: "Updating a Nebius endpoint",
      },
    );

    return this.status(deployment);
  }

  scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState> {
    return this.patch(deployment, {
      scaling: {
        min_replicas: Math.max(1, scaling.minReplicas),
        max_replicas: Math.max(1, scaling.maxReplicas),
      },
    });
  }

  pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.patch(deployment, { enabled: false });
  }

  resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.patch(deployment, { enabled: true });
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    await this.http.json(
      `/v0/dedicated_endpoints/${encodeURIComponent(this.endpointId(deployment))}`,
      {
        method: "DELETE",
        context: "Deleting a Nebius endpoint",
        allowNotFound: true,
      },
    );
  }

  invoke(deployment: HostedDeployment, request: ChatInvocation): Promise<ChatInvocationResult> {
    const [, routingKey, region] = deployment.providerRef.split("|");

    return invokeOpenAiCompatible({
      baseUrl: nebiusInferenceUrl(region || null),
      headers: bearer(this.apiKey),
      model: routingKey,
      request,
      fetcher: this.context.fetcher,
      context: "Calling a Nebius endpoint",
    });
  }

  async list(): Promise<string[]> {
    const body = readRecord(
      await this.http.json(`/v0/dedicated_endpoints${this.projectQuery()}`, {
        context: "Listing Nebius endpoints",
      }),
    );

    return readArray(body.endpoints ?? body.data).flatMap((item) => {
      const record = readRecord(item);
      const id = readNonEmptyString(record.id);

      return id && (readNonEmptyString(record.description) ?? "").startsWith("Polychat deployment")
        ? [
            `${id}|${readNonEmptyString(record.routing_key) ?? ""}|${readNonEmptyString(record.region) ?? ""}`,
          ]
        : [];
    });
  }
}

export class NebiusConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    await nebius(this.context).http.json("/v1/models", { context: "Checking the Nebius API key" });

    return {
      account: this.context.credentials.config.projectId || "Nebius project",
      capabilities: { read: true, store: false, train: true, host: true },
      namespaces: [],
      message: null,
    };
  }
}
