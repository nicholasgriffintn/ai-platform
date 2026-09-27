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
  readArray,
  readNonEmptyString,
  readRecord,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import { GoogleTokenSource, readGoogleSettings, type GoogleSettings } from "../auth/google.js";
import { unsupported } from "../errors.js";
import { bearer, JsonHttpClient } from "../http.js";
import { invokeOpenAiCompatible } from "../openai-compatible.js";
import { hubWeights, requireTrainingData, scriptSpec } from "../training/payload.js";
import { TRAINING_IMAGE, TRAINING_SCRIPT, trainingCommand } from "../training/script.js";
import type {
  ChatInvocation,
  ChatInvocationResult,
  ConnectionChecker,
  Host,
  HostDeploymentInput,
  HostDeploymentState,
  HostedDeployment,
  ProviderAdapterContext,
  Trainer,
  TrainingJobState,
  TrainingSubmission,
} from "../types.js";

export const VERTEX_REGIONS: RegionOption[] = [
  { id: "europe-west2", label: "London", jurisdiction: "uk" },
  { id: "europe-west4", label: "Netherlands", jurisdiction: "eu" },
  { id: "europe-west1", label: "Belgium", jurisdiction: "eu" },
  { id: "us-central1", label: "Iowa", jurisdiction: "us" },
  { id: "us-east4", label: "Virginia", jurisdiction: "us" },
  { id: "asia-southeast1", label: "Singapore", jurisdiction: "apac" },
];

export const VERTEX_MACHINES: HardwareOption[] = [
  {
    id: "g2-standard-12:NVIDIA_L4:1",
    label: "g2-standard-12 · L4 (24 GB)",
    accelerator: "nvidia-l4",
    count: 1,
    memoryGb: 24,
    hourlyUsd: 1.0,
  },
  {
    id: "g2-standard-48:NVIDIA_L4:4",
    label: "g2-standard-48 · 4× L4 (96 GB)",
    accelerator: "nvidia-l4",
    count: 4,
    memoryGb: 96,
    hourlyUsd: 4.0,
  },
  {
    id: "a2-ultragpu-1g:NVIDIA_A100_80GB:1",
    label: "a2-ultragpu-1g · A100 (80 GB)",
    accelerator: "nvidia-a100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 5.07,
  },
  {
    id: "a3-highgpu-1g:NVIDIA_H100_80GB:1",
    label: "a3-highgpu-1g · H100 (80 GB)",
    accelerator: "nvidia-h100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 11.06,
  },
  {
    id: "a3-highgpu-8g:NVIDIA_H100_80GB:8",
    label: "a3-highgpu-8g · 8× H100 (640 GB)",
    accelerator: "nvidia-h100",
    count: 8,
    memoryGb: 640,
    hourlyUsd: 88.49,
  },
];

export const VERTEX_TRAINER: TrainerManifest = {
  id: "vertex-custom-job",
  name: "Vertex AI custom job",
  description:
    "Runs the Polychat TRL recipe as a Vertex custom job in your Google Cloud project, pushing results to your Hub organisation.",
  methods: [
    "sft",
    "dpo",
    "rft",
    "distillation",
    "continued_pretraining",
    "embedding",
    "merge",
    "quantise",
  ],
  adaptations: ["lora", "qlora", "full"],
  datasetShapes: ["messages", "preference", "prompt_grader", "text", "retrieval"],
  graderKinds: ["exact", "contains", "regex", "json_schema", "numeric"],
  bases: { kind: "hub", models: ["*"], maxParameters: null },
  hardware: VERTEX_MACHINES,
  regions: VERTEX_REGIONS,
  output: "hub",
  pricing: { unit: "gpu_hour", usd: null, note: "Machine and accelerator hours in your project" },
};

export const VERTEX_HOST: HostManifest = {
  pauseSupported: false,
  id: "vertex",
  name: "Vertex AI Model Garden",
  description:
    "Deploys a Hub model to a Vertex endpoint with Google's vLLM container. Model Garden loads the repository head, so weights are not pinned to your approved commit.",
  shapes: ["dedicated"],
  weights: "hub",
  adapters: false,
  scaleToZero: false,
  weightsVerified: false,
  retention: "self",
  engines: ["vllm"],
  quantisations: ["none"],
  hardware: VERTEX_MACHINES,
  regions: VERTEX_REGIONS,
  architectures: ["*"],
  maxParameters: null,
  pricing: { unit: "gpu_hour", usd: null, note: "Node hours while replicas run" },
};

export const GOOGLE_VERTEX_MANIFEST: ProviderManifest = {
  id: "google-vertex",
  name: "Google Cloud Vertex AI",
  vendor: "Google Cloud",
  description: "Train and serve in your own Google Cloud project, including London and EU regions.",
  docsUrl: "https://cloud.google.com/vertex-ai/docs",
  connection: {
    fields: [
      {
        key: "serviceAccountJson",
        label: "Service account key (JSON)",
        kind: "secret",
        required: true,
        help: "Needs Vertex AI User on the project.",
      },
      {
        key: "region",
        label: "Region",
        kind: "select",
        required: true,
        options: VERTEX_REGIONS.map((region) => ({
          value: region.id,
          label: `${region.label} (${region.id})`,
        })),
      },
      {
        key: "projectId",
        label: "Project ID",
        kind: "text",
        required: false,
        help: "Defaults to the key's project.",
      },
    ],
  },
  source: false,
  store: null,
  trainers: [VERTEX_TRAINER],
  hosts: [VERTEX_HOST],
};

const JOB_STATES: Record<string, TrainingRunStatus> = {
  JOB_STATE_QUEUED: "submitted",
  JOB_STATE_PENDING: "submitted",
  JOB_STATE_RUNNING: "running",
  JOB_STATE_SUCCEEDED: "completed",
  JOB_STATE_FAILED: "failed",
  JOB_STATE_CANCELLING: "running",
  JOB_STATE_CANCELLED: "cancelled",
  JOB_STATE_EXPIRED: "failed",
};

class VertexClient {
  readonly settings: GoogleSettings;
  readonly http: JsonHttpClient;
  private readonly tokens: GoogleTokenSource;

  constructor(context: ProviderAdapterContext) {
    this.settings = readGoogleSettings(context.credentials);
    this.tokens = new GoogleTokenSource(this.settings.account, context.fetcher);
    this.http = new JsonHttpClient(
      `https://${this.settings.region}-aiplatform.googleapis.com`,
      async () => bearer(await this.tokens.token()),
      context.fetcher,
    );
  }

  token(): Promise<string> {
    return this.tokens.token();
  }

  location(): string {
    return `projects/${this.settings.projectId}/locations/${this.settings.region}`;
  }
}

function machine(hardware: string | null) {
  const [machineType, acceleratorType, count] = (hardware ?? VERTEX_MACHINES[0].id).split(":");

  return { machineType, acceleratorType, acceleratorCount: Number(count) || 1 };
}

export class VertexTrainer implements Trainer {
  readonly manifest = VERTEX_TRAINER;
  private readonly client: VertexClient;

  constructor(private readonly context: ProviderAdapterContext) {
    this.client = new VertexClient(context);
  }

  async submit(submission: TrainingSubmission): Promise<TrainingJobState> {
    requireTrainingData(submission);

    const hub = this.context.hub;

    if (!hub) {
      throw unsupported("Vertex custom jobs push results to the Hub; connect Hugging Face first");
    }

    const body = await this.client.http.record(`/v1/${this.client.location()}/customJobs`, {
      method: "POST",
      body: {
        displayName: slugify(`polychat-${submission.runId}`, 120),
        labels: { "polychat-run": slugify(submission.runId, 60) },
        jobSpec: {
          workerPoolSpecs: [
            {
              machineSpec: machine(submission.spec.target.hardware),
              replicaCount: 1,
              diskSpec: { bootDiskType: "pd-ssd", bootDiskSizeGb: 300 },
              containerSpec: {
                imageUri: TRAINING_IMAGE,
                command: trainingCommand(submission.spec.method).slice(0, 2),
                args: trainingCommand(submission.spec.method).slice(2),
                env: Object.entries({
                  POLYCHAT_SPEC: JSON.stringify(scriptSpec(submission)),
                  POLYCHAT_TRAINING_SCRIPT: TRAINING_SCRIPT,
                  POLYCHAT_OUTPUT: "hub",
                  HF_TOKEN: hub.token,
                  METRICS_URL: submission.reportUrl,
                  ...(submission.train ? { TRAIN_URL: submission.train.file.url } : {}),
                  ...(submission.validation
                    ? { VALIDATION_URL: submission.validation.file.url }
                    : {}),
                }).map(([name, value]) => ({ name, value })),
              },
            },
          ],
        },
      },
      context: "Starting a Vertex custom job",
    });

    return this.toState(body, submission.outputRepository);
  }

  private toState(
    body: Record<string, unknown>,
    outputRepository: string | null,
  ): TrainingJobState {
    const status = JOB_STATES[String(body.state)] ?? "running";
    const env = readArray(
      readRecord(readRecord(readArray(readRecord(body.jobSpec).workerPoolSpecs)[0]).containerSpec)
        .env,
    ).map(readRecord);
    const spec = env.find((item) => item.name === "POLYCHAT_SPEC")?.value;
    const repo =
      outputRepository ??
      (typeof spec === "string"
        ? readNonEmptyString(readRecord(JSON.parse(spec)).outputRepository)
        : undefined);

    return {
      status,
      providerJobId: readNonEmptyString(body.name) ?? "unknown",
      metrics: [],
      checkpoints: [],
      output: status === "completed" && repo ? { kind: "hub", repo, revision: "main" } : null,
      costUsd: null,
      failureReason: readNonEmptyString(readRecord(body.error).message) ?? null,
      startedAt: readNonEmptyString(body.startTime) ?? null,
      completedAt: readNonEmptyString(body.endTime) ?? null,
    };
  }

  async status(providerJobId: string): Promise<TrainingJobState> {
    return this.toState(
      await this.client.http.record(`/v1/${providerJobId}`, {
        context: "Reading a Vertex custom job",
      }),
      null,
    );
  }

  async cancel(providerJobId: string): Promise<void> {
    await this.client.http.json(`/v1/${providerJobId}:cancel`, {
      method: "POST",
      body: {},
      context: "Cancelling a Vertex custom job",
    });
  }
}

export class VertexHost implements Host {
  readonly manifest = VERTEX_HOST;
  private readonly client: VertexClient;

  constructor(private readonly context: ProviderAdapterContext) {
    this.client = new VertexClient(context);
  }

  private state(
    providerRef: string,
    status: DeploymentStatus,
    hardware: string | null,
    failure: string | null = null,
  ): HostDeploymentState {
    return {
      status,
      providerRef,
      region: this.client.settings.region,
      readyReplicas: null,
      hourlyUsd:
        status === "running"
          ? (VERTEX_MACHINES.find((item) => item.id === hardware)?.hourlyUsd ?? null)
          : 0,
      failureReason: failure,
    };
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    if (input.adapters.length > 0) {
      throw unsupported("Model Garden deploys one model; merge adapters before deploying");
    }

    const weights = hubWeights(input.model);
    const body = await this.client.http.record(`/v1/${this.client.location()}:deploy`, {
      method: "POST",
      body: {
        huggingFaceModelId: weights.repo,
        ...(this.context.hub ? { huggingFaceAccessToken: this.context.hub.token } : {}),
        modelConfig: { acceptEula: true },
        endpointConfig: { endpointDisplayName: input.name },
        deployConfig: {
          dedicatedResources: {
            machineSpec: machine(input.spec.target.hardware),
            minReplicaCount: Math.max(1, input.spec.scaling.minReplicas),
            maxReplicaCount: Math.max(1, input.spec.scaling.maxReplicas),
          },
        },
      },
      context: "Deploying on Vertex Model Garden",
    });
    const operation = readNonEmptyString(body.name);

    if (!operation) {
      throw unsupported("Vertex did not return a deployment operation");
    }

    return this.state(`operation|${operation}`, "provisioning", input.spec.target.hardware);
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const [kind, name] = deployment.providerRef.split("|");
    const hardware = deployment.spec.target.hardware;

    if (kind === "operation") {
      const body = await this.client.http.record(`/v1/${name}`, {
        context: "Reading a Vertex deployment",
      });

      if (body.done !== true) {
        return this.state(deployment.providerRef, "provisioning", hardware);
      }

      const error = readRecord(body.error);

      if (Object.keys(error).length > 0) {
        return this.state(
          deployment.providerRef,
          "failed",
          hardware,
          readNonEmptyString(error.message) ?? null,
        );
      }

      const endpoint = readNonEmptyString(readRecord(body.response).endpoint);

      return endpoint
        ? this.state(`endpoint|${endpoint}`, "running", hardware)
        : this.state(deployment.providerRef, "failed", hardware, "Vertex returned no endpoint");
    }

    const body = await this.client.http.json(`/v1/${name}`, {
      context: "Reading a Vertex endpoint",
      allowNotFound: true,
    });

    if (body === null) {
      return this.state(deployment.providerRef, "deleted", hardware);
    }

    return readArray(readRecord(body).deployedModels).length > 0
      ? this.state(deployment.providerRef, "running", hardware)
      : this.state(deployment.providerRef, "paused", hardware);
  }

  async scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState> {
    const [kind, name] = deployment.providerRef.split("|");

    if (kind !== "endpoint") {
      return this.status(deployment);
    }

    const endpoint = readRecord(
      await this.client.http.record(`/v1/${name}`, { context: "Reading a Vertex endpoint" }),
    );

    for (const model of readArray(endpoint.deployedModels).map(readRecord)) {
      await this.client.http.json(`/v1/${name}:mutateDeployedModel`, {
        method: "POST",
        body: {
          deployedModel: {
            id: model.id,
            dedicatedResources: {
              ...readRecord(model.dedicatedResources),
              minReplicaCount: Math.max(1, scaling.minReplicas),
              maxReplicaCount: Math.max(1, scaling.maxReplicas),
            },
          },
          updateMask: "dedicatedResources.minReplicaCount,dedicatedResources.maxReplicaCount",
        },
        context: "Scaling a Vertex deployment",
      });
    }

    return this.status(deployment);
  }

  async pause(): Promise<HostDeploymentState> {
    throw unsupported("Vertex endpoints cannot pause; scale down or delete instead");
  }

  async resume(): Promise<HostDeploymentState> {
    throw unsupported("Vertex endpoints cannot pause; scale down or delete instead");
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    const [kind, name] = deployment.providerRef.split("|");

    if (kind !== "endpoint") {
      return;
    }

    const endpoint = await this.client.http.json(`/v1/${name}`, {
      context: "Reading a Vertex endpoint",
      allowNotFound: true,
    });

    if (endpoint === null) {
      return;
    }

    for (const model of readArray(readRecord(endpoint).deployedModels).map(readRecord)) {
      await this.client.http.json(`/v1/${name}:undeployModel`, {
        method: "POST",
        body: { deployedModelId: model.id },
        context: "Undeploying a Vertex model",
      });
    }

    await this.client.http.json(`/v1/${name}`, {
      method: "DELETE",
      context: "Deleting a Vertex endpoint",
      allowNotFound: true,
    });
  }

  async invoke(
    deployment: HostedDeployment,
    request: ChatInvocation,
  ): Promise<ChatInvocationResult> {
    const [kind, name] = deployment.providerRef.split("|");

    if (kind !== "endpoint") {
      throw unsupported("The Vertex deployment has not finished");
    }

    return invokeOpenAiCompatible({
      baseUrl: `https://${this.client.settings.region}-aiplatform.googleapis.com/v1beta1/${name}`,
      headers: bearer(await this.client.token()),
      model: null,
      request,
      fetcher: this.context.fetcher,
      context: "Calling a Vertex endpoint",
    });
  }

  async list(): Promise<string[]> {
    const body = await this.client.http.record(`/v1/${this.client.location()}/endpoints`, {
      context: "Listing Vertex endpoints",
    });

    return readArray(body.endpoints).flatMap((item) => {
      const name = readNonEmptyString(readRecord(item).name);

      return name ? [`endpoint|${name}`] : [];
    });
  }
}

export class VertexConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    const client = new VertexClient(this.context);

    await client.http.json(`/v1/${client.location()}/endpoints?pageSize=1`, {
      context: "Checking the Vertex AI project",
    });

    return {
      account: client.settings.account.clientEmail,
      capabilities: { read: true, store: false, train: Boolean(this.context.hub), host: true },
      namespaces: [{ name: client.settings.projectId, canWrite: true }],
      message: this.context.hub ? null : "Connect Hugging Face to train on Vertex",
    };
  }
}
