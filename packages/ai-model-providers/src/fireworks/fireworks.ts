import type {
  ConnectionCheck,
  DeploymentStatus,
  HardwareOption,
  HostManifest,
  ProviderManifest,
  TrainerManifest,
  TrainingRunStatus,
} from "@ngriffin_uk/polychat-schemas";
import {
  readArray,
  readNonEmptyString,
  readRecord,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import { misconfigured, unsupported } from "../errors.js";
import { bearer, JsonHttpClient, streamingMultipart } from "../http.js";
import { HuggingFaceHubClient } from "../huggingface/hub.js";
import { invokeOpenAiCompatible } from "../openai-compatible.js";
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
  ModelHandle,
  ProviderAdapterContext,
  Trainer,
  TrainingJobState,
  TrainingSubmission,
} from "../types.js";

export const FIREWORKS_API = "https://api.fireworks.ai/v1";
export const FIREWORKS_INFERENCE_API = "https://api.fireworks.ai/inference/v1";

export const FIREWORKS_BASES: Record<string, string> = {
  "meta-llama/Llama-3.1-8B-Instruct": "accounts/fireworks/models/llama-v3p1-8b-instruct",
  "meta-llama/Llama-3.1-70B-Instruct": "accounts/fireworks/models/llama-v3p1-70b-instruct",
  "meta-llama/Llama-3.3-70B-Instruct": "accounts/fireworks/models/llama-v3p3-70b-instruct",
  "meta-llama/Llama-3.2-3B-Instruct": "accounts/fireworks/models/llama-v3p2-3b-instruct",
  "Qwen/Qwen2.5-7B-Instruct": "accounts/fireworks/models/qwen2p5-7b-instruct",
  "Qwen/Qwen2.5-72B-Instruct": "accounts/fireworks/models/qwen2p5-72b-instruct",
  "Qwen/Qwen3-8B": "accounts/fireworks/models/qwen3-8b",
  "Qwen/Qwen3-32B": "accounts/fireworks/models/qwen3-32b",
  "mistralai/Mistral-7B-Instruct-v0.3": "accounts/fireworks/models/mistral-7b-instruct-v3",
  "google/gemma-3-27b-it": "accounts/fireworks/models/gemma-3-27b-it",
  "openai/gpt-oss-20b": "accounts/fireworks/models/gpt-oss-20b",
  "openai/gpt-oss-120b": "accounts/fireworks/models/gpt-oss-120b",
};

export const FIREWORKS_HARDWARE: HardwareOption[] = [
  {
    id: "NVIDIA_A100_80GB:1",
    label: "A100 (80 GB)",
    accelerator: "nvidia-a100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 2.9,
  },
  {
    id: "NVIDIA_H100_80GB:1",
    label: "H100 (80 GB)",
    accelerator: "nvidia-h100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 5.8,
  },
  {
    id: "NVIDIA_H100_80GB:2",
    label: "2× H100 (160 GB)",
    accelerator: "nvidia-h100",
    count: 2,
    memoryGb: 160,
    hourlyUsd: 11.6,
  },
  {
    id: "NVIDIA_H100_80GB:8",
    label: "8× H100 (640 GB)",
    accelerator: "nvidia-h100",
    count: 8,
    memoryGb: 640,
    hourlyUsd: 46.4,
  },
  {
    id: "NVIDIA_H200_141GB:1",
    label: "H200 (141 GB)",
    accelerator: "nvidia-h200",
    count: 1,
    memoryGb: 141,
    hourlyUsd: 6.99,
  },
  {
    id: "NVIDIA_B200_180GB:1",
    label: "B200 (180 GB)",
    accelerator: "nvidia-b200",
    count: 1,
    memoryGb: 180,
    hourlyUsd: 11.99,
  },
  {
    id: "AMD_MI300X_192GB:1",
    label: "MI300X (192 GB)",
    accelerator: "amd-mi300x",
    count: 1,
    memoryGb: 192,
    hourlyUsd: 4.99,
  },
];

const FIREWORKS_REGIONS = [
  { id: "US_IOWA_1", label: "US (Iowa)", jurisdiction: "us" as const },
  { id: "EU_NETHERLANDS_1", label: "EU (Netherlands)", jurisdiction: "eu" as const },
];

export const FIREWORKS_TRAINER: TrainerManifest = {
  id: "fireworks-fine-tuning",
  name: "Fireworks fine-tuning",
  description:
    "Managed LoRA supervised fine-tuning on Fireworks bases; the adapter serves from hundreds-per-deployment pools.",
  methods: ["sft", "distillation"],
  adaptations: ["lora"],
  datasetShapes: ["messages"],
  graderKinds: [],
  bases: { kind: "catalogue", models: Object.keys(FIREWORKS_BASES), maxParameters: null },
  hardware: [],
  regions: [FIREWORKS_REGIONS[0]],
  output: "provider",
  pricing: { unit: "million_tokens", usd: null, note: "Priced per training token by base size" },
};

export const FIREWORKS_HOST: HostManifest = {
  id: "fireworks",
  name: "Fireworks deployments",
  description:
    "On-demand deployments with LoRA add-ons, scale-to-zero and FP8 or FP4 precision, or serverless for catalogue models.",
  shapes: ["serverless", "dedicated", "adapter_pool"],
  weights: "hub",
  adapters: true,
  scaleToZero: true,
  weightsVerified: true,
  retention: "zero",
  engines: ["provider"],
  quantisations: ["none", "fp8", "nvfp4"],
  hardware: FIREWORKS_HARDWARE,
  regions: FIREWORKS_REGIONS,
  architectures: [
    "llama",
    "mistral",
    "mixtral",
    "qwen2",
    "qwen3",
    "qwen3_moe",
    "gemma2",
    "gemma3",
    "deepseek_v3",
    "gpt_oss",
  ],
  maxParameters: null,
  pricing: { unit: "gpu_hour", usd: null, note: "Per GPU second while replicas run" },
};

export const FIREWORKS_MANIFEST: ProviderManifest = {
  id: "fireworks",
  name: "Fireworks AI",
  vendor: "Fireworks AI",
  description: "Fast serving with LoRA add-on pools, on-demand GPUs and managed fine-tuning.",
  docsUrl: "https://docs.fireworks.ai",
  connection: {
    fields: [
      { key: "apiKey", label: "API key", kind: "secret", required: true },
      { key: "accountId", label: "Account ID", kind: "text", required: true },
    ],
  },
  source: false,
  store: null,
  trainers: [FIREWORKS_TRAINER],
  hosts: [FIREWORKS_HOST],
};

const JOB_STATES: Record<string, TrainingRunStatus> = {
  JOB_STATE_CREATING: "submitted",
  JOB_STATE_PENDING: "submitted",
  JOB_STATE_VALIDATING: "preparing",
  JOB_STATE_RUNNING: "running",
  JOB_STATE_WRITING_RESULTS: "running",
  JOB_STATE_COMPLETED: "completed",
  JOB_STATE_FAILED: "failed",
  JOB_STATE_CANCELLED: "cancelled",
  JOB_STATE_EXPIRED: "failed",
};

const DEPLOYMENT_STATES: Record<string, DeploymentStatus> = {
  CREATING: "provisioning",
  READY: "running",
  UPDATING: "updating",
  DELETING: "deleting",
  DELETED: "deleted",
  FAILED: "failed",
};

function account(context: ProviderAdapterContext): {
  http: JsonHttpClient;
  apiKey: string;
  accountId: string;
} {
  const apiKey = context.credentials.secrets.apiKey;
  const accountId = context.credentials.config.accountId;

  if (!apiKey || !accountId) {
    throw misconfigured("The Fireworks connection needs an API key and account ID");
  }

  return {
    http: new JsonHttpClient(
      `${FIREWORKS_API}/accounts/${encodeURIComponent(accountId)}`,
      () => bearer(apiKey),
      context.fetcher,
    ),
    apiKey,
    accountId,
  };
}

export class FireworksTrainer implements Trainer {
  readonly manifest = FIREWORKS_TRAINER;
  private readonly http: JsonHttpClient;
  private readonly accountId: string;

  constructor(context: ProviderAdapterContext) {
    const resolved = account(context);

    this.http = resolved.http;
    this.accountId = resolved.accountId;
  }

  private async dataset(runId: string, split: string, dataset: DatasetHandle): Promise<string> {
    const datasetId = slugify(`polychat-${runId}-${split}`, 60);

    await this.http.json("/datasets", {
      method: "POST",
      body: {
        datasetId,
        dataset: {
          displayName: `${dataset.name} (${split})`,
          exampleCount: String(dataset.rows),
          format: "CHAT",
          userUploaded: {},
        },
      },
      context: "Creating a Fireworks dataset",
    });

    const multipart = streamingMultipart(
      {},
      {
        field: "file",
        filename: dataset.file.filename,
        contentType: "application/jsonl",
        stream: await dataset.file.open(),
      },
    );

    await this.http.json(`/datasets/${datasetId}:upload`, {
      method: "POST",
      rawBody: multipart.body,
      headers: { "Content-Type": multipart.contentType },
      context: "Uploading a Fireworks dataset",
    });

    return `accounts/${this.accountId}/datasets/${datasetId}`;
  }

  async submit(submission: TrainingSubmission): Promise<TrainingJobState> {
    const base =
      submission.base.weights.kind === "hub"
        ? FIREWORKS_BASES[submission.base.weights.repo]
        : undefined;

    if (!base) {
      throw unsupported(`${submission.base.name} is not a Fireworks tuning base`);
    }

    if (!submission.train) {
      throw unsupported("Fireworks fine-tuning needs a training dataset");
    }

    const hp = submission.spec.hyperparameters;
    const outputModel = `accounts/${this.accountId}/models/${slugify(submission.spec.outputName, 60)}`;
    const body = await this.http.record("/supervisedFineTuningJobs", {
      method: "POST",
      body: {
        displayName: submission.spec.outputName,
        baseModel: base,
        dataset: await this.dataset(submission.runId, "train", submission.train),
        ...(submission.validation
          ? {
              evaluationDataset: await this.dataset(
                submission.runId,
                "validation",
                submission.validation,
              ),
            }
          : {}),
        outputModel,
        epochs: Math.max(1, Math.round(hp.epochs)),
        learningRate: hp.learningRate ?? 1e-4,
        loraRank: hp.loraRank,
        maxContextLength: hp.maxSequenceLength,
      },
      context: "Starting a Fireworks fine-tune",
    });

    return this.toState(body);
  }

  private toState(body: Record<string, unknown>): TrainingJobState {
    const status = JOB_STATES[String(body.state)] ?? "running";
    const name = readNonEmptyString(body.name) ?? "unknown";
    const outputModel = readNonEmptyString(body.outputModel);

    return {
      status,
      providerJobId: name.split("/").pop() ?? name,
      metrics: [],
      checkpoints: [],
      output:
        status === "completed" && outputModel
          ? { kind: "provider", provider: "fireworks", ref: outputModel }
          : null,
      costUsd: null,
      failureReason: readNonEmptyString(readRecord(body.status).message) ?? null,
      startedAt: readNonEmptyString(body.createTime) ?? null,
      completedAt: readNonEmptyString(body.completedTime) ?? null,
    };
  }

  async status(providerJobId: string): Promise<TrainingJobState> {
    return this.toState(
      await this.http.record(`/supervisedFineTuningJobs/${encodeURIComponent(providerJobId)}`, {
        context: "Reading a Fireworks fine-tune",
      }),
    );
  }

  async cancel(providerJobId: string): Promise<void> {
    await this.http.json(`/supervisedFineTuningJobs/${encodeURIComponent(providerJobId)}`, {
      method: "DELETE",
      context: "Cancelling a Fireworks fine-tune",
      allowNotFound: true,
    });
  }
}

type FireworksRef =
  | { kind: "serverless"; model: string }
  | { kind: "deployment"; model: string; deployment: string };

function parseRef(value: string): FireworksRef {
  const [kind, model, deployment] = value.split("|");

  return kind === "deployment" && deployment
    ? { kind, model, deployment }
    : { kind: "serverless", model };
}

function formatRef(ref: FireworksRef): string {
  return ref.kind === "serverless"
    ? `serverless|${ref.model}`
    : `deployment|${ref.model}|${ref.deployment}`;
}

export class FireworksHost implements Host {
  readonly manifest = FIREWORKS_HOST;
  private readonly http: JsonHttpClient;
  private readonly apiKey: string;
  private readonly accountId: string;

  constructor(private readonly context: ProviderAdapterContext) {
    const resolved = account(context);

    this.http = resolved.http;
    this.apiKey = resolved.apiKey;
    this.accountId = resolved.accountId;
  }

  private state(
    ref: FireworksRef,
    status: DeploymentStatus,
    hourly: number | null = null,
    failure: string | null = null,
  ): HostDeploymentState {
    return {
      status,
      providerRef: formatRef(ref),
      region: null,
      readyReplicas: null,
      hourlyUsd: hourly,
      failureReason: failure,
    };
  }

  private async uploadFromHub(model: ModelHandle, modelId: string): Promise<string> {
    const weights = hubWeights(model);
    const hub = new HuggingFaceHubClient({
      token: this.context.hub?.token,
      fetcher: this.context.fetcher,
    });
    const reference = { kind: "model" as const, repo: weights.repo, revision: weights.revision };
    const files = (await hub.listFiles(reference)).filter(
      (file) => !file.path.startsWith("checkpoints/"),
    );
    const name = `accounts/${this.accountId}/models/${modelId}`;

    await this.http.json("/models", {
      method: "POST",
      body: {
        modelId,
        model: {
          displayName: modelId,
          kind: model.kind === "adapter" ? "HF_PEFT_ADDON" : "HF_BASE_MODEL",
          ...(model.kind === "adapter" && model.base
            ? { peftDetails: { baseModel: FIREWORKS_BASES[hubWeights(model.base).repo] ?? "" } }
            : {}),
        },
      },
      context: "Registering a model on Fireworks",
    });

    const endpoint = await this.http.record(`/models/${modelId}:getUploadEndpoint`, {
      method: "POST",
      body: {
        filenameToSize: Object.fromEntries(files.map((file) => [file.path, String(file.size)])),
      },
      context: "Requesting Fireworks upload URLs",
    });
    const signed = readRecord(endpoint.filenameToSignedUrls);

    for (const file of files) {
      const url = signed[file.path];

      if (typeof url !== "string") {
        continue;
      }

      const source = await hub.openFile({ ...reference, path: file.path });
      const upload = await this.context.fetcher(url, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: source.body,
      });

      if (!upload.ok) {
        throw unsupported(`Uploading ${file.path} to Fireworks failed with ${upload.status}`);
      }
    }

    await this.http.json(`/models/${modelId}:validateUpload`, {
      method: "GET",
      context: "Validating the Fireworks upload",
    });

    return name;
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    if (
      input.model.weights.kind === "hub" &&
      input.spec.shape === "serverless" &&
      input.adapters.length === 0
    ) {
      const catalogue = FIREWORKS_BASES[input.model.weights.repo];

      if (!catalogue) {
        throw unsupported(`${input.model.name} is not on Fireworks serverless`);
      }

      return this.state({ kind: "serverless", model: catalogue }, "running", 0);
    }

    const base =
      input.model.weights.kind === "provider"
        ? input.model.weights.ref
        : input.model.weights.kind === "hub" && FIREWORKS_BASES[input.model.weights.repo]
          ? FIREWORKS_BASES[input.model.weights.repo]
          : await this.uploadFromHub(input.model, slugify(`${input.name}-base`, 60));
    const adapters: string[] = [];

    for (const adapter of input.adapters) {
      adapters.push(
        adapter.weights.kind === "provider"
          ? adapter.weights.ref
          : await this.uploadFromHub(adapter, slugify(`${input.name}-${adapter.versionId}`, 60)),
      );
    }

    if (input.spec.shape === "serverless" && adapters.length === 1) {
      await this.http.json("/deployedModels", {
        method: "POST",
        body: { model: adapters[0], serverless: true, displayName: input.name },
        context: "Deploying a LoRA add-on on Fireworks serverless",
      });

      return this.state({ kind: "serverless", model: adapters[0] }, "running", 0);
    }

    const [accelerator, count] = (input.spec.target.hardware ?? FIREWORKS_HARDWARE[1].id).split(
      ":",
    );
    const scaleToZero = input.spec.scaling.scaleToZeroAfterMinutes;
    const deployment = await this.http.record("/deployments", {
      method: "POST",
      body: {
        displayName: input.name,
        baseModel: base,
        minReplicaCount: input.spec.scaling.minReplicas,
        maxReplicaCount: Math.max(1, input.spec.scaling.maxReplicas),
        acceleratorType: accelerator,
        acceleratorCount: Number(count) || 1,
        enableAddons: adapters.length > 0,
        ...(input.spec.quantisation === "fp8"
          ? { precision: "FP8" }
          : input.spec.quantisation === "nvfp4"
            ? { precision: "FP4" }
            : {}),
        ...(scaleToZero
          ? { autoscalingPolicy: { scaleToZeroWindow: `${Math.max(5, scaleToZero) * 60}s` } }
          : {}),
        ...(input.spec.target.region ? { placement: { region: input.spec.target.region } } : {}),
      },
      context: "Creating a Fireworks deployment",
    });
    const deploymentName = readNonEmptyString(deployment.name);

    if (!deploymentName) {
      throw unsupported("Fireworks did not return a deployment name");
    }

    for (const adapter of adapters) {
      await this.http.json("/deployedModels", {
        method: "POST",
        body: { model: adapter, deployment: deploymentName, displayName: `${input.name}-addon` },
        context: "Loading a LoRA add-on on Fireworks",
      });
    }

    return this.deploymentState(
      { kind: "deployment", model: adapters[0] ?? base, deployment: deploymentName },
      deployment,
      input.spec.target.hardware,
    );
  }

  private deploymentState(
    ref: FireworksRef,
    body: Record<string, unknown>,
    hardware: string | null,
  ): HostDeploymentState {
    const status = DEPLOYMENT_STATES[String(body.state)] ?? "provisioning";
    const replicas = Number(body.replicaCount ?? NaN);
    const rate = FIREWORKS_HARDWARE.find((item) => item.id === hardware)?.hourlyUsd ?? null;

    return {
      ...this.state(
        ref,
        status === "running" && replicas === 0 ? "scaled_to_zero" : status,
        null,
        readNonEmptyString(readRecord(body.status).message) ?? null,
      ),
      readyReplicas: Number.isFinite(replicas) ? replicas : null,
      hourlyUsd: rate !== null && Number.isFinite(replicas) ? rate * replicas : rate,
      region: readNonEmptyString(readRecord(body.placement).region) ?? null,
    };
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const ref = parseRef(deployment.providerRef);

    if (ref.kind !== "deployment") {
      return this.state(ref, "running", 0);
    }

    const body = await this.http.json(`/deployments/${ref.deployment.split("/").pop()}`, {
      context: "Reading a Fireworks deployment",
      allowNotFound: true,
    });

    return body === null
      ? this.state(ref, "deleted", 0)
      : this.deploymentState(ref, readRecord(body), deployment.spec.target.hardware);
  }

  async scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState> {
    const ref = parseRef(deployment.providerRef);

    if (ref.kind === "deployment") {
      await this.http.json(
        `/deployments/${ref.deployment.split("/").pop()}?updateMask=minReplicaCount,maxReplicaCount`,
        {
          method: "PATCH",
          body: { minReplicaCount: scaling.minReplicas, maxReplicaCount: scaling.maxReplicas },
          context: "Scaling a Fireworks deployment",
        },
      );
    }

    return this.status(deployment);
  }

  pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.scale(deployment, { minReplicas: 0, maxReplicas: 0 });
  }

  resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.scale(deployment, {
      minReplicas: deployment.spec.scaling.minReplicas,
      maxReplicas: Math.max(1, deployment.spec.scaling.maxReplicas),
    });
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    const ref = parseRef(deployment.providerRef);

    if (ref.kind === "deployment") {
      await this.http.json(`/deployments/${ref.deployment.split("/").pop()}`, {
        method: "DELETE",
        context: "Deleting a Fireworks deployment",
        allowNotFound: true,
      });
    }
  }

  invoke(deployment: HostedDeployment, request: ChatInvocation): Promise<ChatInvocationResult> {
    const ref = parseRef(deployment.providerRef);

    return invokeOpenAiCompatible({
      baseUrl: FIREWORKS_INFERENCE_API,
      headers: bearer(this.apiKey),
      model: ref.kind === "deployment" ? `${ref.model}#${ref.deployment}` : ref.model,
      request,
      fetcher: this.context.fetcher,
      context: "Calling a Fireworks model",
    });
  }

  async list(): Promise<string[]> {
    const body = await this.http.record("/deployments?pageSize=200", {
      context: "Listing Fireworks deployments",
    });

    return readArray(body.deployments).flatMap((item) => {
      const record = readRecord(item);
      const name = readNonEmptyString(record.name);
      const model = readNonEmptyString(record.baseModel);

      return name && model ? [formatRef({ kind: "deployment", model, deployment: name })] : [];
    });
  }
}

export class FireworksConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    const { http, accountId } = account(this.context);

    await http.json("", { context: "Checking the Fireworks account" });

    return {
      account: accountId,
      capabilities: { read: true, store: false, train: true, host: true },
      namespaces: [],
      message: null,
    };
  }
}
