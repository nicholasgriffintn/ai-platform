import type { TrainingRunStatus } from "@ngriffin_uk/polychat-schemas";
import { readNonEmptyString, readRecord } from "@ngriffin_uk/polychat-utility-core";

import { misconfigured } from "../errors.js";
import { bearer, type Fetcher, JsonHttpClient } from "../http.js";
import { requireTrainingData, scriptSpec } from "../training/payload.js";
import { TRAINING_IMAGE, TRAINING_SCRIPT, trainingCommand } from "../training/script.js";
import type {
  ProviderAdapterContext,
  Trainer,
  TrainingJobState,
  TrainingSubmission,
} from "../types.js";
import { HF_JOB_FLAVOURS, HF_JOBS_TRAINER } from "./manifest.js";

export const HUGGINGFACE_JOBS_API = "https://huggingface.co/api/jobs";

const DEFAULT_FLAVOUR = "a10g-large";
const DEFAULT_TIMEOUT_SECONDS = 8 * 60 * 60;
const RUN_LABEL = "polychat-run";

const STAGES: Record<string, TrainingRunStatus> = {
  SCHEDULING: "submitted",
  RUNNING: "running",
  COMPLETED: "completed",
  ERROR: "failed",
  CANCELED: "cancelled",
  DELETED: "cancelled",
};

export interface HubJobRequest {
  image: string;
  command: string[];
  environment: Record<string, string>;
  secrets: Record<string, string>;
  flavour: string;
  timeoutSeconds: number;
  labels: Record<string, string>;
}

export interface HubJobState {
  id: string;
  stage: string;
  message: string | null;
  flavour: string | null;
  environment: Record<string, unknown>;
  createdAt: string | null;
  finishedAt: string | null;
}

export function readHubAccess(context: ProviderAdapterContext): {
  token: string;
  namespace: string;
} {
  const token = context.credentials.secrets.token;
  const namespace = context.credentials.config.namespace;

  if (!token || !namespace) {
    throw misconfigured("The Hugging Face connection needs a token and an organisation");
  }

  return { token, namespace };
}

export class HuggingFaceJobsClient {
  private readonly http: JsonHttpClient;

  constructor(
    private readonly namespace: string,
    token: string,
    fetcher: Fetcher,
  ) {
    this.http = new JsonHttpClient(HUGGINGFACE_JOBS_API, () => bearer(token), fetcher);
  }

  private path(suffix = ""): string {
    return `/${encodeURIComponent(this.namespace)}${suffix}`;
  }

  async run(request: HubJobRequest): Promise<HubJobState> {
    return readHubJob(
      await this.http.json(this.path(), {
        method: "POST",
        body: {
          dockerImage: request.image,
          command: request.command,
          environment: request.environment,
          secrets: request.secrets,
          flavor: request.flavour,
          timeoutSeconds: request.timeoutSeconds,
          labels: request.labels,
        },
        context: "Starting a Hugging Face job",
      }),
    );
  }

  async inspect(jobId: string): Promise<HubJobState> {
    return readHubJob(
      await this.http.json(this.path(`/${encodeURIComponent(jobId)}`), {
        context: `Reading Hugging Face job ${jobId}`,
      }),
    );
  }

  async cancel(jobId: string): Promise<void> {
    await this.http.json(this.path(`/${encodeURIComponent(jobId)}/cancel`), {
      method: "POST",
      body: {},
      context: `Cancelling Hugging Face job ${jobId}`,
    });
  }
}

export function readHubJob(body: unknown): HubJobState {
  const record = readRecord(body);
  const status = readRecord(record.status);

  return {
    id: readNonEmptyString(record.id) ?? "unknown",
    stage: readNonEmptyString(status.stage) ?? "SCHEDULING",
    message: readNonEmptyString(status.message) ?? null,
    flavour: readNonEmptyString(record.flavor) ?? null,
    environment: readRecord(record.environment),
    createdAt: readNonEmptyString(record.createdAt) ?? null,
    finishedAt: readNonEmptyString(record.finishedAt) ?? null,
  };
}

export function hubJobCost(job: HubJobState, now = Date.now()): number | null {
  const hourly = HF_JOB_FLAVOURS.find((flavour) => flavour.id === job.flavour)?.hourlyUsd;

  if (hourly === undefined || hourly === null || !job.createdAt) {
    return null;
  }

  const end = job.finishedAt ? Date.parse(job.finishedAt) : now;
  const hours = Math.max(0, end - Date.parse(job.createdAt)) / 3_600_000;

  return Math.round(hours * hourly * 100) / 100;
}

function toTrainingState(job: HubJobState): TrainingJobState {
  const status = STAGES[job.stage] ?? "running";
  const outputRepository = readNonEmptyString(job.environment.POLYCHAT_OUTPUT_REPOSITORY);

  return {
    status,
    providerJobId: job.id,
    metrics: [],
    checkpoints: [],
    output:
      status === "completed" && outputRepository
        ? { kind: "hub", repo: outputRepository, revision: "main" }
        : null,
    costUsd: hubJobCost(job),
    failureReason: status === "failed" || status === "cancelled" ? job.message : null,
    startedAt: job.createdAt,
    completedAt: job.finishedAt,
  };
}

export class HuggingFaceJobsTrainer implements Trainer {
  readonly manifest = HF_JOBS_TRAINER;
  private readonly client: HuggingFaceJobsClient;
  private readonly token: string;

  constructor(context: ProviderAdapterContext) {
    const access = readHubAccess(context);

    this.token = access.token;
    this.client = new HuggingFaceJobsClient(access.namespace, access.token, context.fetcher);
  }

  async submit(submission: TrainingSubmission): Promise<TrainingJobState> {
    requireTrainingData(submission);

    const hardware = submission.spec.target.hardware ?? DEFAULT_FLAVOUR;
    const timeoutHours = Number(submission.spec.providerOptions.timeoutHours);
    const job = await this.client.run({
      image: TRAINING_IMAGE,
      command: trainingCommand(submission.spec.method),
      environment: {
        POLYCHAT_SPEC: JSON.stringify(scriptSpec(submission)),
        POLYCHAT_TRAINING_SCRIPT: TRAINING_SCRIPT,
        POLYCHAT_OUTPUT: "hub",
        POLYCHAT_OUTPUT_REPOSITORY: submission.outputRepository,
      },
      secrets: {
        HF_TOKEN: this.token,
        METRICS_URL: submission.reportUrl,
        ...(submission.train ? { TRAIN_URL: submission.train.file.url } : {}),
        ...(submission.validation ? { VALIDATION_URL: submission.validation.file.url } : {}),
      },
      flavour: hardware,
      timeoutSeconds:
        Number.isFinite(timeoutHours) && timeoutHours > 0
          ? Math.round(timeoutHours * 3600)
          : DEFAULT_TIMEOUT_SECONDS,
      labels: { [RUN_LABEL]: submission.runId },
    });

    return toTrainingState(job);
  }

  async status(providerJobId: string): Promise<TrainingJobState> {
    return toTrainingState(await this.client.inspect(providerJobId));
  }

  async cancel(providerJobId: string): Promise<void> {
    await this.client.cancel(providerJobId);
  }
}
