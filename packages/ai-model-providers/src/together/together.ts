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

export const TOGETHER_API = "https://api.together.xyz/v1";

export const TOGETHER_HARDWARE: HardwareOption[] = [
  {
    id: "1x_nvidia_l40s_48gb",
    label: "L40S (48 GB)",
    accelerator: "nvidia-l40s",
    count: 1,
    memoryGb: 48,
    hourlyUsd: 2.1,
  },
  {
    id: "1x_nvidia_a100_80gb_sxm",
    label: "A100 (80 GB)",
    accelerator: "nvidia-a100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 2.56,
  },
  {
    id: "2x_nvidia_a100_80gb_sxm",
    label: "2× A100 (160 GB)",
    accelerator: "nvidia-a100",
    count: 2,
    memoryGb: 160,
    hourlyUsd: 5.12,
  },
  {
    id: "1x_nvidia_h100_80gb_sxm",
    label: "H100 (80 GB)",
    accelerator: "nvidia-h100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 3.36,
  },
  {
    id: "2x_nvidia_h100_80gb_sxm",
    label: "2× H100 (160 GB)",
    accelerator: "nvidia-h100",
    count: 2,
    memoryGb: 160,
    hourlyUsd: 6.72,
  },
  {
    id: "4x_nvidia_h100_80gb_sxm",
    label: "4× H100 (320 GB)",
    accelerator: "nvidia-h100",
    count: 4,
    memoryGb: 320,
    hourlyUsd: 13.44,
  },
  {
    id: "8x_nvidia_h100_80gb_sxm",
    label: "8× H100 (640 GB)",
    accelerator: "nvidia-h100",
    count: 8,
    memoryGb: 640,
    hourlyUsd: 26.88,
  },
];

const TOGETHER_REGION = [{ id: "us", label: "Together (US)", jurisdiction: "us" as const }];

export const TOGETHER_TRAINER: TrainerManifest = {
  id: "together-fine-tuning",
  name: "Together fine-tuning",
  description:
    "Managed SFT and DPO with LoRA or full weights, started from your pinned Hub base and exported to your organisation.",
  methods: ["sft", "dpo", "distillation", "continued_pretraining"],
  adaptations: ["lora", "full"],
  datasetShapes: ["messages", "preference", "text"],
  graderKinds: [],
  bases: { kind: "hub", models: ["*"], maxParameters: 1_100_000_000_000 },
  hardware: [],
  regions: TOGETHER_REGION,
  output: "hub",
  pricing: { unit: "million_tokens", usd: null, note: "Priced per token trained, by model size" },
};

export const TOGETHER_HOST: HostManifest = {
  id: "together",
  name: "Together inference",
  description:
    "Serverless per-token models and serverless LoRA adapters, or single-tenant dedicated endpoints for your uploaded weights.",
  shapes: ["serverless", "dedicated", "adapter_pool"],
  weights: "hub",
  adapters: true,
  scaleToZero: true,
  weightsVerified: true,
  retention: "zero",
  engines: ["provider"],
  quantisations: ["none", "fp8"],
  hardware: TOGETHER_HARDWARE,
  regions: TOGETHER_REGION,
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
  pricing: {
    unit: "gpu_hour",
    usd: null,
    note: "Dedicated endpoints bill per GPU minute; serverless per token",
  },
};

export const TOGETHER_MANIFEST: ProviderManifest = {
  id: "together",
  name: "Together AI",
  vendor: "Together AI",
  description:
    "Fine-tune open models and serve them serverless, as LoRA adapters or on dedicated GPUs.",
  docsUrl: "https://docs.together.ai",
  connection: { fields: [{ key: "apiKey", label: "API key", kind: "secret", required: true }] },
  source: false,
  store: null,
  trainers: [TOGETHER_TRAINER],
  hosts: [TOGETHER_HOST],
};

const JOB_STATUS: Record<string, TrainingRunStatus> = {
  pending: "submitted",
  queued: "submitted",
  running: "running",
  compressing: "running",
  uploading: "running",
  cancel_requested: "running",
  cancelled: "cancelled",
  error: "failed",
  completed: "completed",
};

const ENDPOINT_STATE: Record<string, DeploymentStatus> = {
  PENDING: "provisioning",
  STARTING: "provisioning",
  STARTED: "running",
  STOPPING: "paused",
  STOPPED: "paused",
  ERROR: "failed",
};

function client(context: ProviderAdapterContext): JsonHttpClient {
  const apiKey = context.credentials.secrets.apiKey;

  if (!apiKey) {
    throw misconfigured("The Together connection needs an API key");
  }

  return new JsonHttpClient(TOGETHER_API, () => bearer(apiKey), context.fetcher);
}

export class TogetherTrainer implements Trainer {
  readonly manifest = TOGETHER_TRAINER;
  private readonly http: JsonHttpClient;

  constructor(private readonly context: ProviderAdapterContext) {
    this.http = client(context);
  }

  private async upload(dataset: DatasetHandle): Promise<string> {
    return uploadOpenAiStyleFile(
      this.http,
      "/files/upload",
      dataset,
      { purpose: "fine-tune", file_name: dataset.file.filename, file_type: "jsonl" },
      "Uploading a dataset to Together",
    );
  }

  async submit(submission: TrainingSubmission): Promise<TrainingJobState> {
    if (!submission.train) {
      throw unsupported("Together fine-tuning needs a training dataset");
    }

    const base = hubWeights(submission.base);
    const hp = submission.spec.hyperparameters;
    const hub = this.context.hub;
    const trainingFile = await this.upload(submission.train);
    const validationFile = submission.validation ? await this.upload(submission.validation) : null;
    const body = await this.http.record("/fine-tunes", {
      method: "POST",
      body: {
        training_file: trainingFile,
        ...(validationFile ? { validation_file: validationFile, n_evals: 5 } : {}),
        model:
          typeof submission.spec.providerOptions.togetherModel === "string"
            ? submission.spec.providerOptions.togetherModel
            : base.repo,
        from_hf_model: base.repo,
        hf_model_revision: base.revision,
        ...(hub
          ? { hf_api_token: hub.token, hf_output_repo_name: submission.outputRepository }
          : {}),
        n_epochs: Math.max(1, Math.round(hp.epochs)),
        n_checkpoints: submission.spec.checkpointEvery ? 5 : 1,
        learning_rate: hp.learningRate ?? (submission.spec.adaptation === "full" ? 1e-5 : 1e-4),
        batch_size: hp.batchSize,
        max_seq_length: hp.maxSequenceLength,
        warmup_ratio: hp.warmupRatio,
        weight_decay: hp.weightDecay,
        random_seed: hp.seed,
        packing: hp.packing,
        early_stopping_enabled: hp.earlyStopping,
        suffix: slugify(submission.spec.outputName, 60),
        training_method:
          submission.spec.method === "dpo"
            ? { method: "dpo", dpo_beta: hp.dpoBeta }
            : { method: "sft" },
        training_type:
          submission.spec.adaptation === "full"
            ? { type: "Full" }
            : {
                type: "Lora",
                lora_r: hp.loraRank,
                lora_alpha: hp.loraAlpha,
                lora_dropout: hp.loraDropout,
                lora_trainable_modules: "all-linear",
              },
      },
      context: "Starting a Together fine-tune",
    });

    return this.toState(body);
  }

  private toState(body: Record<string, unknown>): TrainingJobState {
    const status = JOB_STATUS[String(body.status)] ?? "running";
    const outputName = readNonEmptyString(body.model_output_name);
    const hfRepo = readNonEmptyString(body.hf_output_repo_name);

    return {
      status,
      providerJobId: readNonEmptyString(body.id) ?? "unknown",
      metrics: [],
      checkpoints: [],
      output:
        status !== "completed"
          ? null
          : hfRepo
            ? { kind: "hub", repo: hfRepo, revision: "main" }
            : outputName
              ? { kind: "provider", provider: "together", ref: outputName }
              : null,
      costUsd: null,
      failureReason:
        status === "failed"
          ? (readArray(body.events)
              .map(readRecord)
              .reverse()
              .map((event) => readNonEmptyString(event.message))
              .find(Boolean) ?? "Together reported an error")
          : null,
      startedAt: readNonEmptyString(body.created_at) ?? null,
      completedAt: status === "completed" ? (readNonEmptyString(body.updated_at) ?? null) : null,
    };
  }

  async status(providerJobId: string): Promise<TrainingJobState> {
    return this.toState(
      await this.http.record(`/fine-tunes/${encodeURIComponent(providerJobId)}`, {
        context: "Reading a Together fine-tune",
      }),
    );
  }

  async cancel(providerJobId: string): Promise<void> {
    await this.http.json(`/fine-tunes/${encodeURIComponent(providerJobId)}/cancel`, {
      method: "POST",
      body: {},
      context: "Cancelling a Together fine-tune",
    });
  }
}

type TogetherRef =
  | { kind: "serverless"; model: string }
  | { kind: "upload"; jobId: string; model: string }
  | { kind: "endpoint"; id: string; model: string };

function parseRef(providerRef: string): TogetherRef {
  const [kind, id, ...rest] = providerRef.split("|");

  if (kind === "upload") {
    return { kind, jobId: id, model: rest.join("|") };
  }

  if (kind === "endpoint") {
    return { kind, id, model: rest.join("|") };
  }

  return { kind: "serverless", model: rest.length ? rest.join("|") : id };
}

function formatRef(ref: TogetherRef): string {
  switch (ref.kind) {
    case "upload":
      return `upload|${ref.jobId}|${ref.model}`;
    case "endpoint":
      return `endpoint|${ref.id}|${ref.model}`;
    default:
      return `serverless|${ref.model}`;
  }
}

export class TogetherHost implements Host {
  readonly manifest = TOGETHER_HOST;
  private readonly http: JsonHttpClient;
  private readonly apiKey: string;

  constructor(private readonly context: ProviderAdapterContext) {
    this.http = client(context);
    this.apiKey = context.credentials.secrets.apiKey;
  }

  private state(
    ref: TogetherRef,
    status: DeploymentStatus,
    failure: string | null = null,
    hourly: number | null = null,
  ): HostDeploymentState {
    return {
      status,
      providerRef: formatRef(ref),
      region: "us",
      readyReplicas: null,
      hourlyUsd: hourly,
      failureReason: failure,
    };
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    const target = input.adapters[0] ?? input.model;

    if (input.adapters.length > 1) {
      throw unsupported("Together serves one adapter per model name");
    }

    if (target.weights.kind === "provider") {
      if (target.weights.provider !== "together") {
        throw unsupported(`${target.name} lives with another provider`);
      }

      return this.startServing(input, target.weights.ref);
    }

    if (input.spec.shape === "serverless" && target.kind === "model") {
      return this.state({ kind: "serverless", model: hubWeights(target).repo }, "running", null, 0);
    }

    const weights = hubWeights(target);
    const modelName = slugify(`${input.name}-${weights.revision.slice(0, 7)}`, 60);
    const body = await this.http.record("/models", {
      method: "POST",
      body: {
        model_name: modelName,
        model_source: `https://huggingface.co/${weights.repo}`,
        ...(this.context.hub ? { hf_token: this.context.hub.token } : {}),
        description: `Polychat deployment ${input.deploymentId} of ${weights.repo}@${weights.revision}`,
        model_type: target.kind === "adapter" ? "adapter" : "model",
        ...(target.kind === "adapter" && target.base
          ? { base_model: hubWeights(target.base).repo }
          : {}),
      },
      context: "Uploading a model to Together",
    });
    const data = readRecord(body.data);
    const jobId = readNonEmptyString(data.job_id);

    if (!jobId) {
      throw unsupported("Together did not return an upload job");
    }

    return this.state(
      { kind: "upload", jobId, model: readNonEmptyString(data.model_name) ?? modelName },
      "provisioning",
    );
  }

  private async startServing(
    input: HostDeploymentInput | HostedDeployment,
    model: string,
  ): Promise<HostDeploymentState> {
    const spec = input.spec;

    if (spec.shape !== "dedicated") {
      return this.state({ kind: "serverless", model }, "running", null, 0);
    }

    const body = await this.http.record("/endpoints", {
      method: "POST",
      body: {
        model,
        hardware: spec.target.hardware ?? TOGETHER_HARDWARE[1].id,
        autoscaling: {
          min_replicas: Math.max(1, spec.scaling.minReplicas),
          max_replicas: Math.max(1, spec.scaling.maxReplicas),
        },
        display_name: "name" in input ? input.name : model,
        inactive_timeout: spec.scaling.scaleToZeroAfterMinutes,
        state: "STARTED",
      },
      context: "Creating a Together dedicated endpoint",
    });
    const id = readNonEmptyString(body.id);

    if (!id) {
      throw unsupported("Together did not return an endpoint id");
    }

    return this.endpointState(
      { kind: "endpoint", id, model: readNonEmptyString(body.name) ?? model },
      body,
      spec.target.hardware,
    );
  }

  private endpointState(
    ref: TogetherRef,
    body: Record<string, unknown>,
    hardware: string | null,
  ): HostDeploymentState {
    const status = ENDPOINT_STATE[String(body.state)] ?? "provisioning";

    return this.state(
      ref,
      status,
      status === "failed" ? "Together reported an endpoint error" : null,
      status === "running"
        ? (TOGETHER_HARDWARE.find((item) => item.id === hardware)?.hourlyUsd ?? null)
        : 0,
    );
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const ref = parseRef(deployment.providerRef);

    if (ref.kind === "serverless") {
      return this.state(ref, "running", null, 0);
    }

    if (ref.kind === "upload") {
      const job = await this.http.record(`/jobs/${encodeURIComponent(ref.jobId)}`, {
        context: "Reading a Together upload job",
      });
      const status = String(job.status).toLowerCase();

      if (status === "complete" || status === "completed") {
        if (deployment.desired !== "running") {
          return this.state(ref, deployment.desired === "deleted" ? "deleted" : "paused", null, 0);
        }

        if (deployment.spec.shape === "dedicated") {
          await this.context.claimProvisioningContinuation?.();
        }

        return this.startServing(deployment, ref.model);
      }

      if (status === "failed" || status === "error") {
        return this.state(
          ref,
          "failed",
          readNonEmptyString(job.status_message) ?? "The upload failed",
        );
      }

      return this.state(ref, "provisioning");
    }

    const body = await this.http.json(`/endpoints/${encodeURIComponent(ref.id)}`, {
      context: "Reading a Together endpoint",
      allowNotFound: true,
    });

    return body === null
      ? this.state(ref, "deleted", null, 0)
      : this.endpointState(
          { ...ref, model: readNonEmptyString(readRecord(body).name) ?? ref.model },
          readRecord(body),
          deployment.spec.target.hardware,
        );
  }

  private async patch(
    deployment: HostedDeployment,
    body: Record<string, unknown>,
  ): Promise<HostDeploymentState> {
    const ref = parseRef(deployment.providerRef);

    if (ref.kind !== "endpoint") {
      return this.status(deployment);
    }

    await this.http.json(`/endpoints/${encodeURIComponent(ref.id)}`, {
      method: "PATCH",
      body,
      context: "Updating a Together endpoint",
    });

    return this.status(deployment);
  }

  scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState> {
    return this.patch(deployment, {
      autoscaling: {
        min_replicas: Math.max(1, scaling.minReplicas),
        max_replicas: scaling.maxReplicas,
      },
    });
  }

  pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.patch(deployment, { state: "STOPPED" });
  }

  resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.patch(deployment, { state: "STARTED" });
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    const ref = parseRef(deployment.providerRef);

    if (ref.kind === "endpoint") {
      await this.http.json(`/endpoints/${encodeURIComponent(ref.id)}`, {
        method: "DELETE",
        context: "Deleting a Together endpoint",
        allowNotFound: true,
      });
    }
  }

  invoke(deployment: HostedDeployment, request: ChatInvocation): Promise<ChatInvocationResult> {
    const ref = parseRef(deployment.providerRef);

    if (ref.kind === "upload") {
      throw unsupported("The Together upload has not finished");
    }

    return invokeOpenAiCompatible({
      baseUrl: TOGETHER_API,
      headers: bearer(this.apiKey),
      model: ref.model,
      request,
      fetcher: this.context.fetcher,
      context: `Calling ${ref.model} on Together`,
    });
  }

  async list(): Promise<string[]> {
    const body = readRecord(
      await this.http.json("/endpoints?type=dedicated", { context: "Listing Together endpoints" }),
    );

    return readArray(body.data).flatMap((item) => {
      const record = readRecord(item);
      const id = readNonEmptyString(record.id);

      return id
        ? [formatRef({ kind: "endpoint", id, model: readNonEmptyString(record.name) ?? id })]
        : [];
    });
  }
}

export class TogetherConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    await client(this.context).json("/models", { context: "Checking the Together API key" });

    return {
      account: "Together project",
      capabilities: { read: true, store: false, train: true, host: true },
      namespaces: [],
      message: this.context.hub
        ? null
        : "Connect Hugging Face too, so fine-tunes land in your organisation instead of staying on Together",
    };
  }
}
