import {
  trainingRecipeSchema,
  type TrainingProviderCredentials,
  type TrainingDeployment,
  type TrainingJob,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { S3ObjectStore } from "../lib/S3ObjectStore.js";
import type { Env } from "../types/env.js";
import type {
  CreateTrainingJobOptions,
  CreateTrainingJobResult,
  DeleteDeploymentOptions,
  DeployModelOptions,
  DeployModelResult,
  TrainingProvider,
} from "../types/providers.js";
import { stringifyEntries } from "../utils/json.js";
import {
  buildHuggingFaceTrainingCommand,
  HUGGINGFACE_TRAINING_IMAGE,
  HUGGINGFACE_TRAINING_SCRIPT,
} from "./huggingFaceTrainingScript.js";

export const HUGGINGFACE_JOBS_API = "https://huggingface.co/api/jobs";
export const HUGGINGFACE_ENDPOINTS_API = "https://api.endpoints.huggingface.cloud/v2/endpoint";
export const HUGGINGFACE_ENDPOINT_IMAGE = "vllm/vllm-openai:v0.11.0";

const DEFAULT_FLAVOR = "a10g-large";
const DEFAULT_TIMEOUT_SECONDS = 4 * 60 * 60;
const TRAINING_URL_TTL_SECONDS = 12 * 60 * 60;
const JOB_LABEL = "polychat-job";

const JOB_STATUS: Record<string, string> = {
  SCHEDULING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  ERROR: "Failed",
  CANCELED: "Cancelled",
  DELETED: "Cancelled",
};

const ENDPOINT_STATUS: Record<string, string> = {
  pending: "Creating",
  initializing: "Creating",
  updating: "Updating",
  updateFailed: "Failed",
  running: "InService",
  paused: "Paused",
  failed: "Failed",
  scaledToZero: "InService",
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export type HuggingFaceTrainingEnv = Pick<
  Env,
  | "HUGGINGFACE_TOKEN"
  | "HUGGINGFACE_NAMESPACE"
  | "HUGGINGFACE_ENDPOINT_VENDOR"
  | "HUGGINGFACE_ENDPOINT_REGION"
  | "AWS_REGION"
  | "AWS_ACCESS_KEY_ID"
  | "AWS_SECRET_ACCESS_KEY"
  | "AWS_SESSION_TOKEN"
  | "SAGEMAKER_REGION"
  | "SAGEMAKER_AWS_ACCESS_KEY_ID"
  | "SAGEMAKER_AWS_SECRET_ACCESS_KEY"
  | "SAGEMAKER_AWS_SESSION_TOKEN"
>;

export function withHuggingFaceCredentials(
  env: HuggingFaceTrainingEnv,
  credentials: TrainingProviderCredentials,
): HuggingFaceTrainingEnv {
  const huggingface = credentials.huggingface;

  return huggingface
    ? {
        ...env,
        HUGGINGFACE_TOKEN: huggingface.token,
        HUGGINGFACE_NAMESPACE: huggingface.namespace ?? env.HUGGINGFACE_NAMESPACE,
        HUGGINGFACE_ENDPOINT_VENDOR: huggingface.endpointVendor,
        HUGGINGFACE_ENDPOINT_REGION: huggingface.endpointRegion,
      }
    : env;
}

export class HuggingFaceTrainingProvider implements TrainingProvider {
  readonly id = "huggingface" as const;

  constructor(
    private readonly env: HuggingFaceTrainingEnv,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private get namespace(): string {
    const namespace = this.env.HUGGINGFACE_NAMESPACE;

    if (!namespace) {
      throw new Error("Missing HUGGINGFACE_NAMESPACE for Hugging Face training");
    }

    return namespace;
  }

  private async request(url: string, init: RequestInit = {}): Promise<unknown> {
    if (!this.env.HUGGINGFACE_TOKEN) {
      throw new Error("Missing HUGGINGFACE_TOKEN for Hugging Face training");
    }

    const headers = new Headers(init.headers);

    headers.set("Authorization", `Bearer ${this.env.HUGGINGFACE_TOKEN}`);
    headers.set("Content-Type", "application/json");

    const response = await this.fetcher(url, { ...init, headers });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Hugging Face request failed (${response.status}): ${text.slice(0, 500)}`);
    }

    return text ? JSON.parse(text) : {};
  }

  private async presignTrainingData(trainingDataS3Uri: string): Promise<string> {
    const { bucket, key } = S3ObjectStore.parseUri(trainingDataS3Uri);
    const accessKeyId = this.env.SAGEMAKER_AWS_ACCESS_KEY_ID || this.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      this.env.SAGEMAKER_AWS_SECRET_ACCESS_KEY || this.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("Missing AWS credentials to share training data with Hugging Face Jobs");
    }

    return new S3ObjectStore({
      bucket,
      region: this.env.SAGEMAKER_REGION || this.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken: this.env.SAGEMAKER_AWS_SESSION_TOKEN || this.env.AWS_SESSION_TOKEN,
      },
      fetcher: this.fetcher,
    }).presignGet(key, TRAINING_URL_TTL_SECONDS);
  }

  async createTrainingJob(options: CreateTrainingJobOptions): Promise<CreateTrainingJobResult> {
    const revision = options.model.baseModelRevision;

    if (!revision) {
      throw new Error("Hugging Face training needs a base model pinned to a commit");
    }

    const recipe = options.recipe ?? "sft-lora";
    const outputRepository = `${this.namespace}/${options.jobName}`;
    const trainUrl = await this.presignTrainingData(options.trainingDataS3Uri);
    const hyperParameters = stringifyEntries(options.hyperParameters ?? {});
    const body = await this.request(
      `${HUGGINGFACE_JOBS_API}/${encodeURIComponent(this.namespace)}`,
      {
        method: "POST",
        body: JSON.stringify({
          dockerImage: options.trainingImage || HUGGINGFACE_TRAINING_IMAGE,
          command: buildHuggingFaceTrainingCommand(),
          environment: {
            ...hyperParameters,
            BASE_MODEL: options.model.baseModel,
            BASE_REVISION: revision,
            OUTPUT_REPO: outputRepository,
            RECIPE: recipe,
            TRUST_REMOTE_CODE: String(
              options.model.defaultHyperparameters.trust_remote_code === "True",
            ),
            TRAINING_SCRIPT: HUGGINGFACE_TRAINING_SCRIPT,
          },
          secrets: { HF_TOKEN: this.env.HUGGINGFACE_TOKEN, TRAIN_URL: trainUrl },
          flavor: options.instanceType || DEFAULT_FLAVOR,
          timeoutSeconds: options.maxRuntimeSeconds ?? DEFAULT_TIMEOUT_SECONDS,
          labels: { [JOB_LABEL]: options.jobName },
        }),
      },
    );
    const job = this.mapJob(body, options.jobName);

    return {
      job: { ...job, modelId: options.model.id, baseModel: options.model.baseModel },
      providerJobId: job.providerJobId,
      metadata: { providerJobId: job.providerJobId, outputRepository, recipe },
    };
  }

  async getJobStatus(jobIdentifier: string): Promise<TrainingJob> {
    return this.mapJob(
      await this.request(
        `${HUGGINGFACE_JOBS_API}/${encodeURIComponent(this.namespace)}/${encodeURIComponent(jobIdentifier)}`,
      ),
    );
  }

  private mapJob(body: unknown, fallbackName?: string): TrainingJob {
    const record = isRecord(body) ? body : {};
    const status = isRecord(record.status) ? record.status : {};
    const labels = isRecord(record.labels) ? record.labels : {};
    const environment = isRecord(record.environment) ? record.environment : {};
    const stage = readString(status.stage) ?? "SCHEDULING";

    return {
      provider: "huggingface",
      jobName: readString(labels[JOB_LABEL]) ?? fallbackName ?? readString(record.id) ?? "unknown",
      providerJobId: readString(record.id),
      status: JOB_STATUS[stage] ?? stage,
      modelId: "unknown",
      baseModel: readString(environment.BASE_MODEL) ?? "unknown",
      recipe: trainingRecipeSchema.safeParse(environment.RECIPE).data,
      outputModelRepository: readString(environment.OUTPUT_REPO),
      trainingImage: readString(record.dockerImage),
      createdAt: readString(record.createdAt),
      startedAt: readString(record.startedAt),
      completedAt: readString(record.finishedAt),
      failureReason:
        stage === "ERROR" || stage === "CANCELED" ? readString(status.message) : undefined,
      providerResponse: body,
    };
  }

  async deployModel(options: DeployModelOptions): Promise<DeployModelResult> {
    const revision = options.model.baseModelRevision;

    if (!revision) {
      throw new Error("Hugging Face endpoints serve a model pinned to a commit");
    }

    const body = await this.request(
      `${HUGGINGFACE_ENDPOINTS_API}/${encodeURIComponent(this.namespace)}`,
      {
        method: "POST",
        body: JSON.stringify({
          name: options.deploymentName,
          type: "protected",
          provider: {
            vendor: this.env.HUGGINGFACE_ENDPOINT_VENDOR || "aws",
            region: this.env.HUGGINGFACE_ENDPOINT_REGION || "eu-west-1",
          },
          compute: {
            accelerator: "gpu",
            instanceType: options.instanceType || "nvidia-l4",
            instanceSize: "x1",
            scaling: { minReplica: 0, maxReplica: Math.max(1, options.instanceCount ?? 1) },
          },
          model: {
            repository: options.model.baseModel,
            revision,
            framework: "pytorch",
            task: "text-generation",
            image: { vLLM: { url: options.inferenceImage || HUGGINGFACE_ENDPOINT_IMAGE } },
            env: options.environment ?? {},
          },
        }),
      },
    );

    return { deployment: this.mapEndpoint(body, options.model.id, options.deploymentVersion) };
  }

  async getDeployment(endpointName: string): Promise<TrainingDeployment> {
    return this.mapEndpoint(
      await this.request(
        `${HUGGINGFACE_ENDPOINTS_API}/${encodeURIComponent(this.namespace)}/${encodeURIComponent(endpointName)}`,
      ),
      "unknown",
    );
  }

  async deleteDeployment({ deployment }: DeleteDeploymentOptions): Promise<void> {
    await this.request(
      `${HUGGINGFACE_ENDPOINTS_API}/${encodeURIComponent(this.namespace)}/${encodeURIComponent(deployment.endpointName)}`,
      { method: "DELETE" },
    );
  }

  private mapEndpoint(
    body: unknown,
    modelId: string,
    deploymentVersion?: string,
  ): TrainingDeployment {
    const record = isRecord(body) ? body : {};
    const status = isRecord(record.status) ? record.status : {};
    const model = isRecord(record.model) ? record.model : {};
    const name = readString(record.name) ?? "unknown";
    const state = readString(status.state) ?? "pending";

    return {
      provider: "huggingface",
      deploymentTarget: "huggingface-endpoint",
      deploymentName: name,
      deploymentVersion,
      modelName: readString(model.repository) ?? modelId,
      endpointConfigName: `${readString(model.repository) ?? name}@${readString(model.revision) ?? "unpinned"}`,
      endpointName: name,
      status: ENDPOINT_STATUS[state] ?? state,
      modelId,
      createdAt: readString(status.createdAt),
      failureReason: readString(status.errorMessage) ?? undefined,
      providerResponse: body,
    };
  }
}
