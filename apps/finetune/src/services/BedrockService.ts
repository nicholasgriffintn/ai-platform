import {
	BedrockClient,
	CreateModelCustomizationJobCommand,
	GetModelCustomizationJobCommand,
	ListModelCustomizationJobsCommand,
	StopModelCustomizationJobCommand,
	type ModelCustomizationJobSummary,
} from "@aws-sdk/client-bedrock";

import type { BedrockJobConfig, JobStatus } from "../types/index.js";
import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("BedrockService");

export class BedrockService {
	private client: BedrockClient;

	constructor() {
		this.client = new BedrockClient({
			region: config.AWS_REGION,
			credentials: {
				accessKeyId: config.AWS_ACCESS_KEY_ID!,
				secretAccessKey: config.AWS_SECRET_ACCESS_KEY!,
			},
		});

		logger.info(`Initialized Bedrock client in region: ${config.AWS_REGION}`);
	}

	async createFineTuningJob(
		jobConfig: BedrockJobConfig,
	): Promise<{ jobArn: string }> {
		logger.info(`Creating fine-tuning job: ${jobConfig.jobName}`);

		const command = new CreateModelCustomizationJobCommand({
			jobName: jobConfig.jobName,
			customModelName: jobConfig.customModelName,
			roleArn: jobConfig.roleArn,
			baseModelIdentifier: jobConfig.baseModelIdentifier,
			customizationType: jobConfig.customizationType || "FINE_TUNING",
			trainingDataConfig: {
				s3Uri: jobConfig.trainingDataS3Uri,
			},
			validationDataConfig: jobConfig.validationDataS3Uri
				? {
						validators: [{ s3Uri: jobConfig.validationDataS3Uri }],
					}
				: undefined,
			outputDataConfig: {
				s3Uri: jobConfig.outputDataS3Uri,
			},
			hyperParameters: jobConfig.hyperParameters,
			customModelKmsKeyId: config.BEDROCK_KMS_KEY_ARN,
			vpcConfig:
				config.BEDROCK_VPC_SECURITY_GROUP_IDS && config.BEDROCK_VPC_SUBNET_IDS
					? {
							securityGroupIds: config.BEDROCK_VPC_SECURITY_GROUP_IDS,
							subnetIds: config.BEDROCK_VPC_SUBNET_IDS,
						}
					: undefined,
		});

		try {
			const response = await this.client.send(command);
			logger.success(`Fine-tuning job created: ${response.jobArn}`);
			return { jobArn: response.jobArn! };
		} catch (error) {
			logger.error("Failed to create fine-tuning job", error);
			throw error;
		}
	}

	async getJobStatus(jobArn: string): Promise<JobStatus> {
		const command = new GetModelCustomizationJobCommand({
			jobIdentifier: jobArn,
		});

		try {
			const response = await this.client.send(command);

			return {
				jobArn: response.jobArn!,
				jobName: response.jobName!,
				status: response.status! as JobStatus["status"],
				message: response.failureMessage,
				creationTime: response.creationTime,
				lastModifiedTime: response.lastModifiedTime,
				endTime: response.endTime,
				trainingMetrics: response.trainingMetrics
					? {
							trainingLoss: response.trainingMetrics.trainingLoss,
						}
					: undefined,
				validationMetrics: response.validationMetrics?.[0]
					? {
							validationLoss: response.validationMetrics[0].validationLoss,
						}
					: undefined,
				outputDataConfig: response.outputDataConfig
					? {
							s3Uri: response.outputDataConfig.s3Uri || "",
						}
					: undefined,
			};
		} catch (error) {
			logger.error("Failed to get job status", error);
			throw error;
		}
	}

	async listJobs(
		maxResults: number = 50,
	): Promise<ModelCustomizationJobSummary[]> {
		logger.info("Listing fine-tuning jobs...");

		const command = new ListModelCustomizationJobsCommand({
			maxResults,
		});

		try {
			const response = await this.client.send(command);
			const jobs = response.modelCustomizationJobSummaries || [];
			logger.success(`Found ${jobs.length} jobs`);
			return jobs;
		} catch (error) {
			logger.error("Failed to list jobs", error);
			throw error;
		}
	}

	async stopJob(jobArn: string): Promise<void> {
		logger.info(`Stopping job: ${jobArn}`);

		const command = new StopModelCustomizationJobCommand({
			jobIdentifier: jobArn,
		});

		try {
			await this.client.send(command);
			logger.success("Job stop requested");
		} catch (error) {
			logger.error("Failed to stop job", error);
			throw error;
		}
	}

	async waitForJobCompletion(
		jobArn: string,
		pollIntervalMs: number = 30000,
		onProgress?: (status: JobStatus) => void,
	): Promise<JobStatus> {
		logger.info(`Waiting for job completion: ${jobArn}`);
		logger.info(`Polling every ${pollIntervalMs / 1000} seconds...`);

		while (true) {
			const status = await this.getJobStatus(jobArn);

			if (onProgress) {
				onProgress(status);
			}

			if (status.status === "Completed") {
				logger.success("Job completed successfully!");
				return status;
			}

			if (status.status === "Failed") {
				logger.error(`Job failed: ${status.message}`);
				throw new Error(`Fine-tuning job failed: ${status.message}`);
			}

			if (status.status === "Stopped") {
				logger.warn("Job was stopped");
				throw new Error("Fine-tuning job was stopped");
			}

			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		}
	}
}
