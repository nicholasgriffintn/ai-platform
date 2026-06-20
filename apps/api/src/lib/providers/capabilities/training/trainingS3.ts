import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	encodeAwsS3Key,
	getAwsS3ObjectUrl,
	hasAwsS3Object,
	putAwsS3Object,
} from "~/lib/providers/utils/awsS3";
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
	accessKeyId: string;
	secretAccessKey: string;
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
	await putAwsS3Object({
		...config,
		key,
		body,
		contentType,
		errorMessage: "Failed to upload training object to S3",
	});
}

export async function hasSageMakerS3Object({
	context,
	bucket,
	key,
}: HeadSageMakerS3ObjectOptions): Promise<boolean> {
	const config = getSageMakerS3Config({ context, bucket });
	return await hasAwsS3Object({
		...config,
		key,
		errorMessage: "Failed to check training object in S3",
	});
}

export function encodeS3Key(key: string): string {
	return encodeAwsS3Key(key);
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
		accessKeyId,
		secretAccessKey,
		bucket: targetBucket,
		region,
	};
}

function getSageMakerS3ObjectUrl(config: SageMakerS3Config, key: string): string {
	return getAwsS3ObjectUrl({ ...config, key });
}
