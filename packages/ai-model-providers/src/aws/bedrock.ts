import type { DeploymentStatus, TrainingRunStatus } from "@ngriffin_uk/polychat-schemas";
import {
  readArray,
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import { AwsRequester, readAwsSettings } from "../auth/aws.js";
import { unsupported } from "../errors.js";
import { hostedFromInput } from "../hosting.js";
import type { JsonHttpClient } from "../http.js";
import type {
  ChatInvocation,
  ChatInvocationResult,
  Host,
  HostDeploymentInput,
  HostDeploymentState,
  HostedDeployment,
  ProviderAdapterContext,
  Trainer,
  TrainingJobState,
  TrainingSubmission,
} from "../types.js";
import { BEDROCK_CUSTOMISABLE_BASES, BEDROCK_HOST, BEDROCK_TRAINER } from "./manifest.js";
import { executionRole, stageDataset, stageModelWeights, workingBucket } from "./staging.js";

const CUSTOMISATION_STATUS: Record<string, TrainingRunStatus> = {
  InProgress: "running",
  Completed: "completed",
  Failed: "failed",
  Stopping: "running",
  Stopped: "cancelled",
};

const IMPORT_STATUS: Record<string, DeploymentStatus> = {
  InProgress: "provisioning",
  Completed: "running",
  Failed: "failed",
};

const DEPLOYMENT_STATUS: Record<string, DeploymentStatus> = {
  Creating: "provisioning",
  Active: "running",
  Failed: "failed",
};

function bedrockClient(aws: AwsRequester): JsonHttpClient {
  return aws.rest("bedrock", `bedrock.${aws.settings.region}.amazonaws.com`);
}

export function toBedrockConversation(record: unknown): unknown {
  const messages = readArray(readRecord(record).messages).map(readRecord);
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => ({ text: readNonEmptyString(message.content) ?? "" }));

  return {
    schemaVersion: "bedrock-conversation-2024",
    ...(system.length ? { system } : {}),
    messages: messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: [{ text: readNonEmptyString(message.content) ?? "" }],
      })),
  };
}

export class BedrockTrainer implements Trainer {
  readonly manifest = BEDROCK_TRAINER;
  private readonly aws: AwsRequester;

  constructor(context: ProviderAdapterContext) {
    this.aws = new AwsRequester(readAwsSettings(context.credentials), context.fetcher);
  }

  async submit(submission: TrainingSubmission): Promise<TrainingJobState> {
    const base =
      submission.base.weights.kind === "hub"
        ? BEDROCK_CUSTOMISABLE_BASES[submission.base.weights.repo]
        : undefined;

    if (!base) {
      throw unsupported(`${submission.base.name} is not customisable on Bedrock`);
    }

    if (!submission.train) {
      throw unsupported("Bedrock customisation needs a training dataset");
    }

    const jobName = slugify(`polychat-${submission.runId}`, 63);
    const trainUri = await stageDataset(
      this.aws,
      submission.runId,
      submission.train,
      "train",
      toBedrockConversation,
    );
    const validationUri = submission.validation
      ? await stageDataset(
          this.aws,
          submission.runId,
          submission.validation,
          "validation",
          toBedrockConversation,
        )
      : null;
    const hp = submission.spec.hyperparameters;
    const body = await bedrockClient(this.aws).record("/model-customization-jobs", {
      method: "POST",
      body: {
        jobName,
        customModelName: submission.spec.outputName,
        roleArn: executionRole(this.aws),
        baseModelIdentifier: base,
        customizationType: "FINE_TUNING",
        trainingDataConfig: { s3Uri: trainUri },
        ...(validationUri
          ? { validationDataConfig: { validators: [{ s3Uri: validationUri }] } }
          : {}),
        outputDataConfig: {
          s3Uri: `s3://${workingBucket(this.aws)}/polychat/runs/${submission.runId}/output/`,
        },
        hyperParameters: {
          epochCount: String(Math.max(1, Math.round(hp.epochs))),
          batchSize: String(hp.batchSize),
          learningRate: String(hp.learningRate ?? 0.0001),
          learningRateWarmupSteps: "0",
        },
        customModelTags: [{ key: "polychat-run", value: submission.runId }],
      },
      context: "Starting a Bedrock customisation job",
    });

    return this.status(readNonEmptyString(body.jobArn) ?? jobName);
  }

  async status(providerJobId: string): Promise<TrainingJobState> {
    const body = await bedrockClient(this.aws).record(
      `/model-customization-jobs/${encodeURIComponent(providerJobId)}`,
      { context: "Reading a Bedrock customisation job" },
    );
    const status = CUSTOMISATION_STATUS[String(body.status)] ?? "running";
    const outputModelArn = readNonEmptyString(body.outputModelArn);

    return {
      status,
      providerJobId,
      metrics: [],
      checkpoints: [],
      output:
        status === "completed" && outputModelArn
          ? { kind: "provider", provider: "aws", ref: outputModelArn }
          : null,
      costUsd: null,
      failureReason: readNonEmptyString(body.failureMessage) ?? null,
      startedAt: readNonEmptyString(body.creationTime) ?? null,
      completedAt: readNonEmptyString(body.endTime) ?? null,
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    await bedrockClient(this.aws).json(
      `/model-customization-jobs/${encodeURIComponent(providerJobId)}/stop`,
      { method: "POST", body: {}, context: "Stopping a Bedrock customisation job" },
    );
  }
}

export class BedrockHost implements Host {
  readonly manifest = BEDROCK_HOST;
  private readonly aws: AwsRequester;

  constructor(private readonly context: ProviderAdapterContext) {
    this.aws = new AwsRequester(readAwsSettings(context.credentials), context.fetcher);
  }

  private region(): string {
    return this.aws.settings.region;
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    if (input.adapters.length > 0) {
      throw unsupported("Bedrock imports one model; merge adapters before deploying");
    }

    const client = bedrockClient(this.aws);

    if (input.model.weights.kind === "provider" && input.model.weights.ref.startsWith("arn:")) {
      const body = await client.record("/model-customization/custom-model-deployments", {
        method: "POST",
        body: {
          modelDeploymentName: input.name,
          modelArn: input.model.weights.ref,
          tags: [{ key: "polychat-deployment", value: input.deploymentId }],
        },
        context: "Deploying a Bedrock custom model",
      });

      return this.status(
        hostedFromInput(
          input,
          `deployment:${readNonEmptyString(body.customModelDeploymentArn) ?? input.name}`,
        ),
      );
    }

    const source = await stageModelWeights(
      this.aws,
      input.model,
      this.context.hub,
      this.context.fetcher,
    );
    const body = await client.record("/model-import-jobs", {
      method: "POST",
      body: {
        jobName: input.name,
        importedModelName: input.name,
        roleArn: executionRole(this.aws),
        modelDataSource: { s3DataSource: { s3Uri: source } },
        importedModelTags: [{ key: "polychat-deployment", value: input.deploymentId }],
      },
      context: "Starting a Bedrock model import",
    });

    return this.status(
      hostedFromInput(input, `import:${readNonEmptyString(body.jobArn) ?? input.name}`),
    );
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const [kind, ref] = splitRef(deployment.providerRef);
    const client = bedrockClient(this.aws);

    if (kind === "deployment") {
      const body = await client.json(
        `/model-customization/custom-model-deployments/${encodeURIComponent(ref)}`,
        { context: "Reading a Bedrock custom model deployment", allowNotFound: true },
      );

      if (body === null) {
        return state(deployment.providerRef, "deleted", this.region(), null);
      }

      const record = readRecord(body);

      return state(
        deployment.providerRef,
        DEPLOYMENT_STATUS[String(record.status)] ?? "provisioning",
        this.region(),
        readNonEmptyString(record.failureMessage) ?? null,
      );
    }

    if (kind === "model") {
      const body = await client.json(`/imported-models/${encodeURIComponent(ref)}`, {
        context: "Reading a Bedrock imported model",
        allowNotFound: true,
      });

      return state(
        deployment.providerRef,
        body === null ? "deleted" : "running",
        this.region(),
        null,
      );
    }

    const body = await client.record(`/model-import-jobs/${encodeURIComponent(ref)}`, {
      context: "Reading a Bedrock import job",
    });
    const status = IMPORT_STATUS[String(body.status)] ?? "provisioning";
    const modelArn = readNonEmptyString(body.importedModelArn);

    return state(
      status === "running" && modelArn ? `model:${modelArn}` : deployment.providerRef,
      status,
      this.region(),
      readNonEmptyString(body.failureMessage) ?? null,
    );
  }

  async scale(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.status(deployment);
  }

  async pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return { ...(await this.status(deployment)), status: "paused" };
  }

  async resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.status(deployment);
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    const [kind, ref] = splitRef(deployment.providerRef);
    const client = bedrockClient(this.aws);

    if (kind === "deployment") {
      await client.json(
        `/model-customization/custom-model-deployments/${encodeURIComponent(ref)}`,
        {
          method: "DELETE",
          context: "Deleting a Bedrock custom model deployment",
          allowNotFound: true,
        },
      );
    }

    if (kind === "model") {
      await client.json(`/imported-models/${encodeURIComponent(ref)}`, {
        method: "DELETE",
        context: "Deleting a Bedrock imported model",
        allowNotFound: true,
      });
    }
  }

  async invoke(
    deployment: HostedDeployment,
    request: ChatInvocation,
  ): Promise<ChatInvocationResult> {
    const [kind, ref] = splitRef(deployment.providerRef);

    if (kind === "import") {
      throw unsupported("The Bedrock import has not finished");
    }

    const runtime = this.aws.rest("bedrock", `bedrock-runtime.${this.region()}.amazonaws.com`);
    const system = request.messages.filter((message) => message.role === "system");
    const body = await runtime.record(`/model/${encodeURIComponent(ref)}/converse`, {
      method: "POST",
      body: {
        ...(system.length ? { system: system.map((message) => ({ text: message.content })) } : {}),
        messages: request.messages
          .filter((message) => message.role !== "system")
          .map((message) => ({ role: message.role, content: [{ text: message.content }] })),
        inferenceConfig: {
          maxTokens: request.maxTokens,
          temperature: request.temperature,
          ...(request.topP === undefined ? {} : { topP: request.topP }),
          ...(request.stop?.length ? { stopSequences: request.stop } : {}),
        },
      },
      context: "Calling a Bedrock model",
    });
    const message = readRecord(readRecord(body.output).message);
    const usage = readRecord(body.usage);

    return {
      text: readArray(message.content)
        .map((part) => readRecord(part).text)
        .filter((text): text is string => typeof text === "string")
        .join(""),
      inputTokens: readFiniteNumber(usage.inputTokens) ?? 0,
      outputTokens: readFiniteNumber(usage.outputTokens) ?? 0,
    };
  }

  async list(): Promise<string[]> {
    const body = await bedrockClient(this.aws).record("/imported-models", {
      context: "Listing Bedrock imported models",
    });

    return readArray(body.modelSummaries).flatMap((summary) => {
      const arn = readNonEmptyString(readRecord(summary).modelArn);

      return arn ? [`model:${arn}`] : [];
    });
  }
}

function splitRef(providerRef: string): ["import" | "model" | "deployment", string] {
  const separator = providerRef.indexOf(":");
  const kind = providerRef.slice(0, separator);
  const ref = providerRef.slice(separator + 1);

  return [kind === "model" || kind === "deployment" ? kind : "import", ref];
}

function state(
  providerRef: string,
  status: DeploymentStatus,
  region: string,
  failureReason: string | null,
): HostDeploymentState {
  return { status, providerRef, region, readyReplicas: null, hourlyUsd: null, failureReason };
}
