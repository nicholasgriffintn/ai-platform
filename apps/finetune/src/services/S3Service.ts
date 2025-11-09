import {
	S3Client,
	PutObjectCommand,
	HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";

import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("S3Service");

export class S3Service {
	private client: S3Client;

	constructor() {
		this.client = new S3Client({
			region: config.AWS_REGION,
			credentials: {
				accessKeyId: config.AWS_ACCESS_KEY_ID!,
				secretAccessKey: config.AWS_SECRET_ACCESS_KEY!,
			},
		});

		logger.info(`Initialized S3 client in region: ${config.AWS_REGION}`);
	}

	async uploadFile(
		filePath: string,
		bucket: string,
		key: string,
	): Promise<{ s3Uri: string }> {
		logger.info(`Uploading ${filePath} to s3://${bucket}/${key}`);

		try {
			const fileContent = readFileSync(filePath);

			const command = new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: fileContent,
				ContentType: "application/jsonl",
			});

			await this.client.send(command);

			const s3Uri = `s3://${bucket}/${key}`;
			logger.success(`Uploaded to ${s3Uri}`);

			return { s3Uri };
		} catch (error) {
			logger.error(`Failed to upload ${filePath}`, error);
			throw error;
		}
	}

	async fileExists(bucket: string, key: string): Promise<boolean> {
		try {
			const command = new HeadObjectCommand({
				Bucket: bucket,
				Key: key,
			});

			await this.client.send(command);
			return true;
		} catch (error: any) {
			if (
				error.name === "NotFound" ||
				error.$metadata?.httpStatusCode === 404
			) {
				return false;
			}
			throw error;
		}
	}

	async uploadDatasets(
		trainPath: string,
		validationPath: string,
		projectName: string,
	): Promise<{
		trainS3Uri: string;
		validationS3Uri: string;
	}> {
		const bucket = config.BEDROCK_TRAINING_BUCKET!;
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const prefix = `${projectName}/${timestamp}`;

		logger.info(`Uploading datasets for project: ${projectName}`);

		const { s3Uri: trainS3Uri } = await this.uploadFile(
			trainPath,
			bucket,
			`${prefix}/train.jsonl`,
		);

		const { s3Uri: validationS3Uri } = await this.uploadFile(
			validationPath,
			bucket,
			`${prefix}/validation.jsonl`,
		);

		return { trainS3Uri, validationS3Uri };
	}

	getOutputS3Uri(projectName: string, jobName: string): string {
		const bucket = config.BEDROCK_OUTPUT_BUCKET!;
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		return `s3://${bucket}/${projectName}/${jobName}/${timestamp}/`;
	}
}
