import {
	getSageMakerEndpointInstanceCompatibilityError,
	type TrainingDeployment,
	type TrainingJob,
} from "@assistant/schemas";

import { signAwsJsonRequest } from "../utils/aws.js";
import { stringifyEntries } from "../utils/json.js";
import { isRecord } from "../utils/objects.js";
import { getSageMakerDeploymentNames } from "../utils/sagemakerDeploymentNames.js";
import type { SageMakerEnv } from "../types/env.js";
import {
	getSageMakerErrorMessage,
	isSageMakerAlreadyExistsError,
	isSageMakerIgnorableDeleteError,
	mapSageMakerDeployment,
	mapSageMakerTrainingJob,
	SageMakerApiError,
} from "../utils/sagemaker.js";
import {
	getSageMakerServerlessCompatibilityError,
	getSageMakerServerlessConfig,
	isSageMakerServerlessDeploymentTarget,
} from "../utils/sagemakerServerless.js";
import type {
	CreateTrainingJobOptions,
	CreateTrainingJobResult,
	DeleteDeploymentOptions,
	DeployModelOptions,
	DeployModelResult,
	TrainingProvider,
} from "../types/providers.js";

export class SageMakerTrainingProvider implements TrainingProvider {
	readonly id = "aws-sagemaker" as const;

	constructor(private readonly env: SageMakerEnv) {}

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

	async getJobStatus(jobIdentifier: string): Promise<TrainingJob> {
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
		const environment = options.environment || {};
		if (!modelArtifactsS3Uri && !environment.HF_MODEL_ID) {
			throw new Error("Deploying a model requires model artifacts, a training job, or HF_MODEL_ID");
		}

		const inferenceImage = this.resolveImage(
			options.inferenceImage || options.model.inferenceImage,
		);
		if (!inferenceImage) {
			throw new Error(`Model ${options.model.id} does not define an inference image`);
		}
		const isServerless = isSageMakerServerlessDeploymentTarget(options.deploymentTarget);
		const serverlessCompatibilityError = isServerless
			? getSageMakerServerlessCompatibilityError(inferenceImage)
			: undefined;
		if (serverlessCompatibilityError) throw new Error(serverlessCompatibilityError);

		const instanceType = isServerless
			? undefined
			: options.instanceType || options.model.defaultDeploymentInstanceType || "ml.g4dn.xlarge";
		const compatibilityError = instanceType
			? getSageMakerEndpointInstanceCompatibilityError({
					instanceType,
					image: inferenceImage,
				})
			: undefined;
		if (compatibilityError) throw new Error(compatibilityError);

		const names = getSageMakerDeploymentNames(options.deploymentName, {
			resourceVersion: options.deploymentVersion,
		});
		const productionVariant = isServerless
			? {
					VariantName: "AllTraffic",
					ModelName: names.modelName,
					InitialVariantWeight: 1,
					ServerlessConfig: getSageMakerServerlessConfig(options),
				}
			: {
					VariantName: "AllTraffic",
					ModelName: names.modelName,
					InitialInstanceCount: options.instanceCount || 1,
					InstanceType: instanceType,
					InitialVariantWeight: 1,
				};

		await this.createSageMakerResource("SageMaker.CreateModel", {
			ModelName: names.modelName,
			ExecutionRoleArn: roleArn,
			PrimaryContainer: this.createPrimaryContainer(
				inferenceImage,
				modelArtifactsS3Uri,
				environment,
			),
		});
		await this.createSageMakerResource("SageMaker.CreateEndpointConfig", {
			EndpointConfigName: names.endpointConfigName,
			ProductionVariants: [productionVariant],
		});
		const endpointOperation = await this.createOrUpdateEndpoint(
			names.endpointName,
			names.endpointConfigName,
		);

		return {
			deployment: {
				provider: this.id,
				deploymentTarget: isServerless ? "sagemaker-serverless-endpoint" : "sagemaker-endpoint",
				deploymentName: names.deploymentName,
				modelName: names.modelName,
				endpointConfigName: names.endpointConfigName,
				endpointName: names.endpointName,
				status: endpointOperation === "update" ? "Updating" : "Creating",
				modelId: options.model.id,
				modelArtifactsS3Uri,
				providerResponse: {
					deploymentTarget: isServerless ? "sagemaker-serverless-endpoint" : "sagemaker-endpoint",
					endpointOperation,
					productionVariant,
				},
			},
		};
	}

	async getDeployment(endpointName: string): Promise<TrainingDeployment> {
		const response = await this.invoke("SageMaker.DescribeEndpoint", {
			EndpointName: endpointName,
		});

		return mapSageMakerDeployment(response, endpointName);
	}

	async deleteDeployment(options: DeleteDeploymentOptions): Promise<void> {
		const { deployment } = options;

		await this.deleteSageMakerResource("SageMaker.DeleteEndpoint", {
			EndpointName: deployment.endpointName,
		});
		await this.deleteSageMakerResource("SageMaker.DeleteEndpointConfig", {
			EndpointConfigName: deployment.endpointConfigName,
		});
		await this.deleteSageMakerResource("SageMaker.DeleteModel", {
			ModelName: deployment.modelName,
		});
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

	private createPrimaryContainer(
		image: string,
		modelArtifactsS3Uri: string | undefined,
		environment: Record<string, string>,
	): Record<string, unknown> {
		return {
			Image: image,
			...(modelArtifactsS3Uri ? { ModelDataUrl: modelArtifactsS3Uri } : {}),
			Environment: environment,
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

	private async createSageMakerResource(
		target: string,
		body: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.invoke(target, body);
		} catch (error) {
			if (isSageMakerAlreadyExistsError(error)) return;

			throw error;
		}
	}

	private async createOrUpdateEndpoint(
		endpointName: string,
		endpointConfigName: string,
	): Promise<"create" | "update"> {
		try {
			await this.invoke("SageMaker.CreateEndpoint", {
				EndpointName: endpointName,
				EndpointConfigName: endpointConfigName,
			});
			return "create";
		} catch (error) {
			if (!isSageMakerAlreadyExistsError(error)) throw error;
		}

		await this.invoke("SageMaker.UpdateEndpoint", {
			EndpointName: endpointName,
			EndpointConfigName: endpointConfigName,
		});
		return "update";
	}

	private async deleteSageMakerResource(
		target: string,
		body: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.invoke(target, body);
		} catch (error) {
			if (isSageMakerIgnorableDeleteError(error)) return;

			throw error;
		}
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
			throw new SageMakerApiError(
				response.statusText,
				response.status,
				getSageMakerErrorMessage(data, text),
			);
		}

		if (!isRecord(data)) {
			throw new Error("SageMaker API returned an invalid JSON payload");
		}

		return data;
	}
}
