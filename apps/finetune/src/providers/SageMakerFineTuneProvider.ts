import type { FineTunedDeployment, FineTuningJob } from "@assistant/schemas";

import { appendResourceNameSuffix, sanitiseResourceName } from "../utils/names.js";
import { signAwsJsonRequest } from "../utils/aws.js";
import { stringifyEntries } from "../utils/json.js";
import { isRecord } from "../utils/objects.js";
import type { Env } from "../types/env.js";
import {
	getSageMakerErrorMessage,
	mapSageMakerDeployment,
	mapSageMakerTrainingJob,
} from "../utils/sagemaker.js";
import type {
	CreateTrainingJobOptions,
	CreateTrainingJobResult,
	DeployModelOptions,
	DeployModelResult,
	FineTuneProvider,
} from "../types/providers.js";

export class SageMakerFineTuneProvider implements FineTuneProvider {
	readonly id = "aws-sagemaker" as const;

	constructor(private readonly env: Env) {}

	async createTrainingJob(options: CreateTrainingJobOptions): Promise<CreateTrainingJobResult> {
		const roleArn = options.roleArn || this.env.SAGEMAKER_ROLE_ARN;
		if (!roleArn) throw new Error("Missing SageMaker execution role ARN");

		const trainingImage = this.resolveImage(options.trainingImage || options.model.trainingImage);
		if (!trainingImage) {
			throw new Error(`Model ${options.model.id} does not define a training image`);
		}

		const outputDataS3Uri = options.outputDataS3Uri || this.defaultOutputS3Uri(options.jobName);
		const hyperParameters = stringifyEntries({
			...options.model.defaultHyperparameters,
			...(options.entryPoint ? { sagemaker_program: options.entryPoint } : {}),
			...(options.sourceS3Uri ? { sagemaker_submit_directory: options.sourceS3Uri } : {}),
			...options.hyperParameters,
		});

		await this.invoke("SageMaker.CreateTrainingJob", {
			TrainingJobName: options.jobName,
			RoleArn: roleArn,
			AlgorithmSpecification: {
				TrainingImage: trainingImage,
				TrainingInputMode: "File",
			},
			HyperParameters: hyperParameters,
			InputDataConfig: [
				this.createChannel("train", options.trainingDataS3Uri),
				...(options.validationDataS3Uri
					? [this.createChannel("test", options.validationDataS3Uri)]
					: []),
			],
			OutputDataConfig: {
				S3OutputPath: outputDataS3Uri,
			},
			ResourceConfig: {
				InstanceType: options.instanceType || options.model.defaultInstanceType || "ml.p3.2xlarge",
				InstanceCount: options.instanceCount || 1,
				VolumeSizeInGB: Number(this.env.SAGEMAKER_VOLUME_SIZE_GB || 30),
			},
			StoppingCondition: {
				MaxRuntimeInSeconds: options.maxRuntimeSeconds || 24 * 60 * 60,
			},
			Tags: [
				{ Key: "provider", Value: this.id },
				{ Key: "modelId", Value: options.model.id },
				{ Key: "family", Value: options.model.family },
			],
		});

		return {
			providerJobId: options.jobName,
			job: {
				provider: this.id,
				jobName: options.jobName,
				status: "Starting",
				modelId: options.model.id,
				baseModel: options.model.baseModel,
				trainingImage,
				trainingDataS3Uri: options.trainingDataS3Uri,
				validationDataS3Uri: options.validationDataS3Uri,
				outputS3Uri: outputDataS3Uri,
			},
			metadata: { outputDataS3Uri, trainingImage },
		};
	}

	async getJobStatus(jobIdentifier: string): Promise<FineTuningJob> {
		const response = await this.invoke("SageMaker.DescribeTrainingJob", {
			TrainingJobName: jobIdentifier,
		});

		return mapSageMakerTrainingJob(response, jobIdentifier);
	}

	async deployModel(options: DeployModelOptions): Promise<DeployModelResult> {
		const roleArn = options.roleArn || this.env.SAGEMAKER_ROLE_ARN;
		if (!roleArn) throw new Error("Missing SageMaker execution role ARN");

		const modelArtifactsS3Uri =
			options.modelArtifactsS3Uri ||
			(options.trainingJobName
				? (await this.getJobStatus(options.trainingJobName)).modelArtifactsS3Uri
				: undefined);
		if (!modelArtifactsS3Uri) {
			throw new Error("Deploying a model requires model artifacts or a training job");
		}

		const inferenceImage = this.resolveImage(
			options.inferenceImage || options.model.inferenceImage,
		);
		if (!inferenceImage) {
			throw new Error(`Model ${options.model.id} does not define an inference image`);
		}

		const deploymentName = sanitiseResourceName(options.deploymentName, {
			fallback: `training-${Date.now()}`,
		});
		const modelName = appendResourceNameSuffix(deploymentName, "model");
		const endpointConfigName = appendResourceNameSuffix(deploymentName, "config");
		const endpointName = appendResourceNameSuffix(deploymentName, "endpoint");

		await this.invoke("SageMaker.CreateModel", {
			ModelName: modelName,
			ExecutionRoleArn: roleArn,
			PrimaryContainer: {
				Image: inferenceImage,
				ModelDataUrl: modelArtifactsS3Uri,
				Environment: options.environment || {},
			},
		});
		await this.invoke("SageMaker.CreateEndpointConfig", {
			EndpointConfigName: endpointConfigName,
			ProductionVariants: [
				{
					VariantName: "AllTraffic",
					ModelName: modelName,
					InitialInstanceCount: options.instanceCount || 1,
					InstanceType:
						options.instanceType || options.model.defaultDeploymentInstanceType || "ml.g4dn.xlarge",
					InitialVariantWeight: 1,
				},
			],
		});
		await this.invoke("SageMaker.CreateEndpoint", {
			EndpointName: endpointName,
			EndpointConfigName: endpointConfigName,
		});

		return {
			deployment: {
				provider: this.id,
				deploymentName,
				modelName,
				endpointConfigName,
				endpointName,
				status: "Creating",
				modelId: options.model.id,
				modelArtifactsS3Uri,
			},
		};
	}

	async getDeployment(endpointName: string): Promise<FineTunedDeployment> {
		const response = await this.invoke("SageMaker.DescribeEndpoint", {
			EndpointName: endpointName,
		});

		return mapSageMakerDeployment(response, endpointName);
	}

	private createChannel(channelName: string, s3Uri: string) {
		return {
			ChannelName: channelName,
			DataSource: {
				S3DataSource: {
					S3DataType: "S3Prefix",
					S3Uri: s3Uri,
					S3DataDistributionType: "FullyReplicated",
				},
			},
			ContentType: "application/jsonlines",
			CompressionType: "None",
		};
	}

	private defaultOutputS3Uri(jobName: string): string {
		if (!this.env.SAGEMAKER_OUTPUT_BUCKET) {
			throw new Error("Missing SAGEMAKER_OUTPUT_BUCKET");
		}

		return `s3://${this.env.SAGEMAKER_OUTPUT_BUCKET}/huggingface/${jobName}/`;
	}

	private resolveImage(image?: string): string | undefined {
		return image?.replace("{region}", this.getRegion());
	}

	private getRegion(): string {
		return this.env.SAGEMAKER_REGION || this.env.AWS_REGION || "us-east-1";
	}

	private getAwsCredentials() {
		const accessKeyId = this.env.SAGEMAKER_AWS_ACCESS_KEY_ID || this.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey =
			this.env.SAGEMAKER_AWS_SECRET_ACCESS_KEY || this.env.AWS_SECRET_ACCESS_KEY;
		const sessionToken = this.env.SAGEMAKER_AWS_SESSION_TOKEN || this.env.AWS_SESSION_TOKEN;
		if (!accessKeyId || !secretAccessKey) throw new Error("Missing AWS credentials for SageMaker");

		return { accessKeyId, secretAccessKey, sessionToken };
	}

	private async invoke(
		target: string,
		body: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		const region = this.getRegion();
		const payload = JSON.stringify(body);
		const endpoint = `https://api.sagemaker.${region}.amazonaws.com/`;
		const headers = signAwsJsonRequest({
			url: endpoint,
			target,
			payload,
			region,
			service: "sagemaker",
			...this.getAwsCredentials(),
		});
		const response = await fetch(endpoint, {
			method: "POST",
			headers,
			body: payload,
		});
		const text = await response.text();
		const data: unknown = text ? JSON.parse(text) : {};
		if (!response.ok) {
			throw new Error(
				`SageMaker API error (${response.status}): ${getSageMakerErrorMessage(data, text)}`,
			);
		}

		if (!isRecord(data)) {
			throw new Error("SageMaker API returned an invalid JSON payload");
		}

		return data;
	}
}
