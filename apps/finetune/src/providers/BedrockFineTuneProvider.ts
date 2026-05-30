import {
	BedrockClient,
	CreateModelCustomizationJobCommand,
	GetModelCustomizationJobCommand,
} from "@aws-sdk/client-bedrock";
import type { FineTuningJob } from "@assistant/schemas";

import { stringifyEntries } from "../utils/json.js";
import type { Env } from "../types/env.js";
import { getBedrockVpcConfig, mapBedrockTrainingJob } from "../utils/bedrock.js";
import type {
	CreateTrainingJobOptions,
	CreateTrainingJobResult,
	FineTuneProvider,
} from "../types/providers.js";

export class BedrockFineTuneProvider implements FineTuneProvider {
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

	async getJobStatus(jobIdentifier: string): Promise<FineTuningJob> {
		const response = await this.createClient().send(
			new GetModelCustomizationJobCommand({
				jobIdentifier,
			}),
		);

		return mapBedrockTrainingJob(response, jobIdentifier);
	}

	private createClient(): BedrockClient {
		return new BedrockClient({
			region: this.env.AWS_REGION || "us-east-1",
			credentials: this.getAwsCredentials(),
		});
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
