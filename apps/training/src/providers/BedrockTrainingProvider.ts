import {
	BedrockClient,
	CreateModelCustomizationJobCommand,
	CreateModelImportJobCommand,
	DeleteImportedModelCommand,
	GetImportedModelCommand,
	GetModelCustomizationJobCommand,
	GetModelImportJobCommand,
} from "@aws-sdk/client-bedrock";
import {
	getBedrockImportModelSourceUriError,
	type TrainingJob,
	type TrainingDeployment,
} from "@assistant/schemas";

import { stringifyEntries } from "../utils/json.js";
import type { Env } from "../types/env.js";
import {
	getBedrockImportedModelIdentifier,
	getBedrockVpcConfig,
	isBedrockResourceNotFoundError,
	mapBedrockImportDeployment,
	mapBedrockImportedModelDeployment,
	mapBedrockTrainingJob,
} from "../utils/bedrock.js";
import { appendResourceNameSuffix } from "../utils/names.js";
import type {
	CreateTrainingJobOptions,
	CreateTrainingJobResult,
	DeleteDeploymentOptions,
	DeployModelOptions,
	DeployModelResult,
	TrainingProvider,
} from "../types/providers.js";
import { stageBedrockImportSource } from "./bedrockImportSource.js";

export class BedrockTrainingProvider implements TrainingProvider {
	readonly id = "aws-bedrock" as const;

	constructor(private readonly env: Env) {}

	async createTrainingJob(options: CreateTrainingJobOptions): Promise<CreateTrainingJobResult> {
		const roleArn = options.roleArn || this.env.BEDROCK_ROLE_ARN;
		if (!roleArn) throw new Error("Missing Bedrock execution role ARN");

		const outputDataS3Uri = options.outputDataS3Uri || this.defaultOutputS3Uri(options.jobName);
		const vpcConfig = getBedrockVpcConfig(this.env);
		const client = this.createClient();
		const response = await client.send(
			new CreateModelCustomizationJobCommand({
				jobName: options.jobName,
				customModelName: options.customModelName || options.jobName,
				roleArn,
				baseModelIdentifier: options.model.baseModel,
				customizationType: "FINE_TUNING",
				trainingDataConfig: {
					s3Uri: options.trainingDataS3Uri,
				},
				...(options.validationDataS3Uri
					? {
							validationDataConfig: {
								validators: [{ s3Uri: options.validationDataS3Uri }],
							},
						}
					: {}),
				outputDataConfig: {
					s3Uri: outputDataS3Uri,
				},
				hyperParameters: stringifyEntries({
					...options.model.defaultHyperparameters,
					...options.hyperParameters,
				}),
				...(this.env.BEDROCK_KMS_KEY_ARN
					? { customModelKmsKeyId: this.env.BEDROCK_KMS_KEY_ARN }
					: {}),
				...(vpcConfig ? { vpcConfig } : {}),
			}),
		);

		return {
			providerJobId: response.jobArn || options.jobName,
			job: {
				provider: this.id,
				jobName: options.jobName,
				status: "InProgress",
				modelId: options.model.id,
				baseModel: options.model.baseModel,
				trainingDataS3Uri: options.trainingDataS3Uri,
				validationDataS3Uri: options.validationDataS3Uri,
				outputS3Uri: outputDataS3Uri,
				providerResponse: response,
			},
			metadata: { jobArn: response.jobArn, outputDataS3Uri },
		};
	}

	async getJobStatus(jobIdentifier: string): Promise<TrainingJob> {
		const response = await this.createClient().send(
			new GetModelCustomizationJobCommand({
				jobIdentifier,
			}),
		);

		return mapBedrockTrainingJob(response, jobIdentifier);
	}

	async deployModel(options: DeployModelOptions): Promise<DeployModelResult> {
		if (options.deploymentTarget !== "bedrock-import") {
			throw new Error("Bedrock deployments only support the bedrock-import target");
		}

		const existing = await this.getImportedModel(options.deploymentName);
		if (existing) {
			return {
				deployment: {
					...existing,
					modelId: options.model.id,
				},
			};
		}

		const roleArn = options.roleArn || this.env.BEDROCK_ROLE_ARN;
		if (!roleArn) throw new Error("Missing Bedrock model import role ARN");

		const vpcConfig = getBedrockVpcConfig(this.env);
		const client = this.createClient();
		const jobName = appendResourceNameSuffix(
			`import-${options.deploymentName}`,
			Date.now().toString(36),
		);
		const modelArtifactsS3Uri = await this.resolveImportSource(options, jobName);
		const response = await client.send(
			new CreateModelImportJobCommand({
				jobName,
				importedModelName: options.deploymentName,
				roleArn,
				modelDataSource: {
					s3DataSource: {
						s3Uri: modelArtifactsS3Uri,
					},
				},
				...(this.env.BEDROCK_KMS_KEY_ARN
					? { importedModelKmsKeyId: this.env.BEDROCK_KMS_KEY_ARN }
					: {}),
				...(vpcConfig ? { vpcConfig } : {}),
				jobTags: [
					{ key: "provider", value: this.id },
					{ key: "modelId", value: options.model.id },
					{ key: "deploymentTarget", value: "bedrock-import" },
				],
				importedModelTags: [
					{ key: "provider", value: this.id },
					{ key: "modelId", value: options.model.id },
				],
			}),
		);

		return {
			deployment: {
				provider: this.id,
				deploymentTarget: "bedrock-import",
				deploymentName: options.deploymentName,
				modelName: options.deploymentName,
				endpointConfigName: response.jobArn || jobName,
				endpointName: jobName,
				status: "InProgress",
				modelId: options.model.id,
				modelArtifactsS3Uri,
				providerResponse: response,
			},
		};
	}

	async getDeployment(endpointName: string): Promise<TrainingDeployment> {
		const response = await this.createClient().send(
			new GetModelImportJobCommand({
				jobIdentifier: endpointName,
			}),
		);

		return mapBedrockImportDeployment(response, endpointName);
	}

	private async getImportedModel(modelIdentifier: string): Promise<TrainingDeployment | null> {
		try {
			const response = await this.createClient().send(
				new GetImportedModelCommand({
					modelIdentifier,
				}),
			);

			return mapBedrockImportedModelDeployment(response, modelIdentifier);
		} catch (error) {
			if (isBedrockResourceNotFoundError(error)) {
				return null;
			}

			throw error;
		}
	}

	async deleteDeployment(options: DeleteDeploymentOptions): Promise<void> {
		const modelIdentifier = getBedrockImportedModelIdentifier(options.deployment);
		if (!modelIdentifier) {
			throw new Error("Missing Bedrock imported model identifier");
		}

		await this.createClient().send(
			new DeleteImportedModelCommand({
				modelIdentifier,
			}),
		);
	}

	private createClient(): BedrockClient {
		return new BedrockClient({
			region: this.env.AWS_REGION || "us-east-1",
			credentials: this.getAwsCredentials(),
		});
	}

	private async resolveImportSource(options: DeployModelOptions, jobName: string): Promise<string> {
		const modelArtifactsS3Uri =
			options.modelArtifactsS3Uri ||
			(options.trainingJobName
				? (await this.getJobStatus(options.trainingJobName)).modelArtifactsS3Uri
				: undefined) ||
			(await stageBedrockImportSource({
				env: this.env,
				model: options.model,
				onEvent: options.onEvent ? (event) => options.onEvent?.({ ...event, jobName }) : undefined,
			}));
		const sourceUriError = getBedrockImportModelSourceUriError(modelArtifactsS3Uri);
		if (sourceUriError) {
			throw new Error(sourceUriError);
		}

		return modelArtifactsS3Uri;
	}

	private getAwsCredentials() {
		const accessKeyId = this.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = this.env.AWS_SECRET_ACCESS_KEY;
		const sessionToken = this.env.AWS_SESSION_TOKEN;

		if (!accessKeyId || !secretAccessKey) {
			return undefined;
		}

		return { accessKeyId, secretAccessKey, sessionToken };
	}

	private defaultOutputS3Uri(jobName: string): string {
		if (!this.env.BEDROCK_OUTPUT_BUCKET) {
			throw new Error("Missing BEDROCK_OUTPUT_BUCKET");
		}

		return `s3://${this.env.BEDROCK_OUTPUT_BUCKET}/bedrock/${jobName}/`;
	}
}
