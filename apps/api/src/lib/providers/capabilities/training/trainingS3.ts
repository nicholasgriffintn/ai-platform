import { AwsClient } from "aws4fetch";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

interface SageMakerS3Options {
	context: ServiceContext;
	bucket?: string;
}

interface PutSageMakerS3ObjectOptions extends SageMakerS3Options {
	key: string;
	body: BodyInit;
	contentType: string;
}

interface HeadSageMakerS3ObjectOptions extends SageMakerS3Options {
	key: string;
}

interface SageMakerS3Config {
	aws: AwsClient;
	bucket: string;
	region: string;
}

export function getSageMakerTrainingRegion(context: ServiceContext): string {
	return context.env.SAGEMAKER_AWS_REGION || context.env.AWS_REGION || "us-east-1";
}

export function resolveSageMakerTrainingBucket(context: ServiceContext, bucket?: string): string {
	const targetBucket = bucket || context.env.SAGEMAKER_BUCKET;
	if (!targetBucket) {
		throw new AssistantError(
			"Missing SAGEMAKER_BUCKET for training storage",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return targetBucket;
}

export async function putSageMakerS3Object({
	context,
	bucket,
	key,
	body,
	contentType,
}: PutSageMakerS3ObjectOptions): Promise<void> {
	const config = getSageMakerS3Config({ context, bucket });
	const response = await config.aws.fetch(getSageMakerS3ObjectUrl(config, key), {
		method: "PUT",
		headers: {
			"Content-Type": contentType,
		},
		body,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new AssistantError(
			`Failed to upload training object to S3 (${response.status}): ${text || response.statusText}`,
			ErrorType.PROVIDER_ERROR,
			response.status,
		);
	}
}

export async function hasSageMakerS3Object({
	context,
	bucket,
	key,
}: HeadSageMakerS3ObjectOptions): Promise<boolean> {
	const config = getSageMakerS3Config({ context, bucket });
	const response = await config.aws.fetch(getSageMakerS3ObjectUrl(config, key), {
		method: "HEAD",
	});

	if (response.ok) return true;
	if (response.status === 404) return false;

	const text = await response.text();
	throw new AssistantError(
		`Failed to check training object in S3 (${response.status}): ${text || response.statusText}`,
		ErrorType.PROVIDER_ERROR,
		response.status,
	);
}

export function encodeS3Key(key: string): string {
	return key.split("/").map(encodeURIComponent).join("/");
}

function getSageMakerS3Config({ context, bucket }: SageMakerS3Options): SageMakerS3Config {
	const region = getSageMakerTrainingRegion(context);
	const targetBucket = resolveSageMakerTrainingBucket(context, bucket);
	const accessKeyId =
		context.env.SAGEMAKER_AWS_ACCESS_KEY || context.env.ASSETS_BUCKET_ACCESS_KEY_ID;
	const secretAccessKey =
		context.env.SAGEMAKER_AWS_SECRET_KEY || context.env.ASSETS_BUCKET_SECRET_ACCESS_KEY;

	if (!accessKeyId || !secretAccessKey) {
		throw new AssistantError(
			"Missing AWS credentials for SageMaker training storage",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return {
		aws: new AwsClient({ accessKeyId, secretAccessKey, region, service: "s3" }),
		bucket: targetBucket,
		region,
	};
}

function getSageMakerS3ObjectUrl(config: SageMakerS3Config, key: string): string {
	return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodeS3Key(key)}`;
}
