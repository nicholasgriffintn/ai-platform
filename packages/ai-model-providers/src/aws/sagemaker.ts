import type { DeploymentStatus, TrainingRunStatus } from "@ngriffin_uk/polychat-schemas";
import {
  epochSecondsToIso,
  readArray,
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import { AwsRequester, readAwsSettings } from "../auth/aws.js";
import { unsupported } from "../errors.js";
import { hostedFromInput } from "../hosting.js";
import { chatCompletionBody, readChatCompletion } from "../openai-compatible.js";
import { requireTrainingData, scriptSpec } from "../training/payload.js";
import { TRAINING_SCRIPT, trainingPackages } from "../training/script.js";
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
import { SAGEMAKER_HOST, SAGEMAKER_INSTANCES, SAGEMAKER_TRAINER } from "./manifest.js";
import { executionRole, stageDataset, stageModelWeights, workingBucket } from "./staging.js";

export const SAGEMAKER_TRAINING_IMAGE =
  "763104351884.dkr.ecr.{region}.amazonaws.com/huggingface-pytorch-training:2.8.0-transformers4.56.2-gpu-py312-cu129-ubuntu22.04";
export const SAGEMAKER_VLLM_IMAGE =
  "763104351884.dkr.ecr.{region}.amazonaws.com/vllm:0.20.2-gpu-py312-cu130-ubuntu22.04-sagemaker";

const DEFAULT_TRAINING_INSTANCE = "ml.g5.2xlarge";
const DEFAULT_ENDPOINT_INSTANCE = "ml.g6.xlarge";

const TRAINING_STATUS: Record<string, TrainingRunStatus> = {
  InProgress: "running",
  Completed: "completed",
  Failed: "failed",
  Stopping: "running",
  Stopped: "cancelled",
};

const ENDPOINT_STATUS: Record<string, DeploymentStatus> = {
  Creating: "provisioning",
  Updating: "updating",
  SystemUpdating: "updating",
  RollingBack: "updating",
  InService: "running",
  OutOfService: "failed",
  Deleting: "deleting",
  Failed: "failed",
};

const QUANTISATION_ENV: Record<string, string> = { fp8: "fp8", awq: "awq", gptq: "gptq" };

function image(template: string, region: string): string {
  return template.replace("{region}", region);
}

function sagemakerHost(aws: AwsRequester): string {
  return `api.sagemaker.${aws.settings.region}.amazonaws.com`;
}

function call(aws: AwsRequester, action: string, payload: unknown) {
  return aws.target(
    "sagemaker",
    sagemakerHost(aws),
    `SageMaker.${action}`,
    payload,
    `SageMaker ${action}`,
  );
}

function instanceRate(instance: string | null): number | null {
  return SAGEMAKER_INSTANCES.find((item) => item.id === instance)?.hourlyUsd ?? null;
}

export class SageMakerTrainer implements Trainer {
  readonly manifest = SAGEMAKER_TRAINER;
  private readonly aws: AwsRequester;

  constructor(private readonly context: ProviderAdapterContext) {
    this.aws = new AwsRequester(readAwsSettings(context.credentials), context.fetcher);
  }

  async submit(submission: TrainingSubmission): Promise<TrainingJobState> {
    requireTrainingData(submission);

    const bucket = workingBucket(this.aws);
    const root = `polychat/runs/${submission.runId}`;
    const jobName = slugify(`polychat-${submission.runId}`, 63);
    const spec = {
      ...scriptSpec(submission),
      output: "dir",
      secrets: {
        METRICS_URL: submission.reportUrl,
        ...(this.context.hub ? { HF_TOKEN: this.context.hub.token } : {}),
      },
    };

    await this.aws.putS3Object(
      bucket,
      `${root}/code/train.py`,
      TRAINING_SCRIPT,
      null,
      "text/x-python",
    );
    await this.aws.putS3Object(
      bucket,
      `${root}/code/spec.json`,
      JSON.stringify(spec),
      null,
      "application/json",
    );

    const channels = [
      { name: "code", uri: `s3://${bucket}/${root}/code/` },
      ...(submission.train
        ? [
            {
              name: "train",
              uri: await stageDataset(this.aws, submission.runId, submission.train, "train"),
            },
          ]
        : []),
      ...(submission.validation
        ? [
            {
              name: "validation",
              uri: await stageDataset(
                this.aws,
                submission.runId,
                submission.validation,
                "validation",
              ),
            },
          ]
        : []),
    ];
    const instance = submission.spec.target.hardware ?? DEFAULT_TRAINING_INSTANCE;
    const maxHours = Number(submission.spec.providerOptions.timeoutHours);

    await call(this.aws, "CreateTrainingJob", {
      TrainingJobName: jobName,
      RoleArn: executionRole(this.aws),
      AlgorithmSpecification: {
        TrainingImage: image(SAGEMAKER_TRAINING_IMAGE, this.aws.settings.region),
        TrainingInputMode: "File",
        ContainerEntrypoint: ["bash", "-lc"],
        ContainerArguments: [
          `pip install --quiet ${trainingPackages(submission.spec.method).join(" ")} && python /opt/ml/input/data/code/train.py`,
        ],
      },
      InputDataConfig: channels.map((channel) => ({
        ChannelName: channel.name,
        DataSource: {
          S3DataSource: {
            S3DataType: "S3Prefix",
            S3Uri: channel.name === "code" ? channel.uri : channel.uri.replace(/data\.jsonl$/, ""),
            S3DataDistributionType: "FullyReplicated",
          },
        },
      })),
      OutputDataConfig: { S3OutputPath: `s3://${bucket}/${root}/output/`, CompressionType: "NONE" },
      ResourceConfig: { InstanceType: instance, InstanceCount: 1, VolumeSizeInGB: 300 },
      StoppingCondition: {
        MaxRuntimeInSeconds:
          Number.isFinite(maxHours) && maxHours > 0 ? Math.round(maxHours * 3600) : 24 * 3600,
      },
      Tags: [{ Key: "polychat-run", Value: submission.runId }],
    });

    return this.status(jobName);
  }

  async status(providerJobId: string): Promise<TrainingJobState> {
    const body = await call(this.aws, "DescribeTrainingJob", { TrainingJobName: providerJobId });
    const status = TRAINING_STATUS[String(body.TrainingJobStatus)] ?? "running";
    const billable = readFiniteNumber(body.BillableTimeInSeconds);
    const rate = instanceRate(
      readNonEmptyString(readRecord(body.ResourceConfig).InstanceType) ?? null,
    );
    const artefacts = readNonEmptyString(readRecord(body.ModelArtifacts).S3ModelArtifacts);

    return {
      status,
      providerJobId,
      metrics: [],
      checkpoints: [],
      output:
        status === "completed" && artefacts
          ? {
              kind: "provider",
              provider: "aws",
              ref: artefacts.endsWith("/") ? artefacts : `${artefacts}/`,
            }
          : null,
      costUsd:
        billable !== undefined && rate !== null
          ? Math.round((billable / 3600) * rate * 100) / 100
          : null,
      failureReason: readNonEmptyString(body.FailureReason) ?? null,
      startedAt: epochSecondsToIso(body.TrainingStartTime),
      completedAt: epochSecondsToIso(body.TrainingEndTime),
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    await call(this.aws, "StopTrainingJob", { TrainingJobName: providerJobId });
  }
}

export class SageMakerHost implements Host {
  readonly manifest = SAGEMAKER_HOST;
  private readonly aws: AwsRequester;

  constructor(private readonly context: ProviderAdapterContext) {
    this.aws = new AwsRequester(readAwsSettings(context.credentials), context.fetcher);
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    if (input.adapters.length > 0) {
      throw unsupported(
        "SageMaker endpoints here serve one model; merge adapters before deploying",
      );
    }

    const name = slugify(`polychat-${input.name}`, 63);
    const environment: Record<string, string> = {
      SM_VLLM_MAX_NUM_SEQS: String(input.spec.maxConcurrency),
      SAGEMAKER_ENABLE_LOAD_AWARE: "1",
    };

    if (input.spec.contextLength) {
      environment.SM_VLLM_MAX_MODEL_LEN = String(input.spec.contextLength);
    }

    if (QUANTISATION_ENV[input.spec.quantisation]) {
      environment.SM_VLLM_QUANTIZATION = QUANTISATION_ENV[input.spec.quantisation];
    }

    const instance = input.spec.target.hardware ?? DEFAULT_ENDPOINT_INSTANCE;
    const accelerators = SAGEMAKER_INSTANCES.find((item) => item.id === instance)?.count ?? 1;

    environment.SM_VLLM_TENSOR_PARALLEL_SIZE = String(accelerators);

    const source = await stageModelWeights(
      this.aws,
      input.model,
      this.context.hub,
      this.context.fetcher,
    );

    await call(this.aws, "CreateModel", {
      ModelName: name,
      ExecutionRoleArn: executionRole(this.aws),
      PrimaryContainer: {
        Image: image(SAGEMAKER_VLLM_IMAGE, this.aws.settings.region),
        ModelDataSource: {
          S3DataSource: { S3Uri: source, S3DataType: "S3Prefix", CompressionType: "None" },
        },
        Environment: environment,
      },
      Tags: [{ Key: "polychat-deployment", Value: input.deploymentId }],
    });
    await call(this.aws, "CreateEndpointConfig", {
      EndpointConfigName: name,
      ProductionVariants: [
        {
          VariantName: "primary",
          ModelName: name,
          InstanceType: instance,
          InitialInstanceCount: Math.max(1, input.spec.scaling.minReplicas),
          ContainerStartupHealthCheckTimeoutInSeconds: 1800,
          ModelDataDownloadTimeoutInSeconds: 1800,
        },
      ],
    });
    await call(this.aws, "CreateEndpoint", { EndpointName: name, EndpointConfigName: name });

    return this.status(hostedFromInput(input, name));
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    let body: Record<string, unknown>;

    try {
      body = await call(this.aws, "DescribeEndpoint", { EndpointName: deployment.providerRef });
    } catch (error) {
      if (error instanceof Error && /Could not find endpoint/i.test(error.message)) {
        return {
          status: "paused",
          providerRef: deployment.providerRef,
          region: this.aws.settings.region,
          readyReplicas: 0,
          hourlyUsd: 0,
          failureReason: null,
        };
      }

      throw error;
    }

    const variant = readRecord(readArray(body.ProductionVariants)[0]);
    const replicas = readFiniteNumber(variant.CurrentInstanceCount) ?? null;
    const rate = instanceRate(deployment.spec.target.hardware ?? DEFAULT_ENDPOINT_INSTANCE);

    return {
      status: ENDPOINT_STATUS[String(body.EndpointStatus)] ?? "provisioning",
      providerRef: deployment.providerRef,
      region: this.aws.settings.region,
      readyReplicas: replicas,
      hourlyUsd: rate !== null && replicas !== null ? rate * replicas : rate,
      failureReason: readNonEmptyString(body.FailureReason) ?? null,
    };
  }

  async scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState> {
    await call(this.aws, "UpdateEndpointWeightsAndCapacities", {
      EndpointName: deployment.providerRef,
      DesiredWeightsAndCapacities: [
        { VariantName: "primary", DesiredInstanceCount: Math.max(1, scaling.minReplicas) },
      ],
    });

    return this.status(deployment);
  }

  async pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    await call(this.aws, "DeleteEndpoint", { EndpointName: deployment.providerRef });

    return { ...(await this.status(deployment)), status: "paused" };
  }

  async resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    await call(this.aws, "CreateEndpoint", {
      EndpointName: deployment.providerRef,
      EndpointConfigName: deployment.providerRef,
    });

    return this.status(deployment);
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    for (const [action, payload] of [
      ["DeleteEndpoint", { EndpointName: deployment.providerRef }],
      ["DeleteEndpointConfig", { EndpointConfigName: deployment.providerRef }],
      ["DeleteModel", { ModelName: deployment.providerRef }],
    ] as const) {
      try {
        await call(this.aws, action, payload);
      } catch (error) {
        if (!(error instanceof Error && /Could not find/i.test(error.message))) {
          throw error;
        }
      }
    }
  }

  async invoke(
    deployment: HostedDeployment,
    request: ChatInvocation,
  ): Promise<ChatInvocationResult> {
    const response = await this.aws.signed(
      "sagemaker",
      `https://runtime.sagemaker.${this.aws.settings.region}.amazonaws.com/endpoints/${encodeURIComponent(deployment.providerRef)}/invocations`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(chatCompletionBody(null, request)),
      },
    );

    if (!response.ok) {
      throw unsupported(`SageMaker endpoint ${deployment.providerRef} returned ${response.status}`);
    }

    return readChatCompletion(await response.json());
  }

  async list(): Promise<string[]> {
    const body = await call(this.aws, "ListEndpoints", {
      NameContains: "polychat-",
      MaxResults: 100,
    });

    return readArray(body.Endpoints).flatMap((endpoint) => {
      const name = readNonEmptyString(readRecord(endpoint).EndpointName);

      return name ? [name] : [];
    });
  }
}
