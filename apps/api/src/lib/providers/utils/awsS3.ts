import { AwsClient } from "aws4fetch";

import { AssistantError, ErrorType } from "~/utils/errors";

interface AwsS3ObjectConfig {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	bucket: string;
}

interface AwsS3ObjectRequest extends AwsS3ObjectConfig {
	key: string;
}

interface PutAwsS3ObjectRequest extends AwsS3ObjectRequest {
	body: BodyInit;
	contentType: string;
	errorMessage?: string;
}

interface HasAwsS3ObjectRequest extends AwsS3ObjectRequest {
	errorMessage?: string;
}

export function encodeAwsS3Key(key: string): string {
	return key.split("/").map(encodeURIComponent).join("/");
}

export function getAwsS3ObjectUrl(config: AwsS3ObjectRequest): string {
	return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodeAwsS3Key(config.key)}`;
}

function createAwsS3Client(config: AwsS3ObjectConfig): AwsClient {
	return new AwsClient({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		region: config.region,
		service: "s3",
	});
}

export async function putAwsS3Object({
	body,
	contentType,
	errorMessage = "Failed to upload object to S3",
	...config
}: PutAwsS3ObjectRequest): Promise<void> {
	const response = await createAwsS3Client(config).fetch(getAwsS3ObjectUrl(config), {
		method: "PUT",
		headers: {
			"Content-Type": contentType,
		},
		body,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new AssistantError(
			`${errorMessage} (${response.status}): ${text || response.statusText}`,
			ErrorType.PROVIDER_ERROR,
			response.status,
		);
	}
}

export async function hasAwsS3Object({
	errorMessage = "Failed to check object in S3",
	...config
}: HasAwsS3ObjectRequest): Promise<boolean> {
	const response = await createAwsS3Client(config).fetch(getAwsS3ObjectUrl(config), {
		method: "HEAD",
	});

	if (response.ok) {
		return true;
	}
	if (response.status === 404) {
		return false;
	}

	const text = await response.text();
	throw new AssistantError(
		`${errorMessage} (${response.status}): ${text || response.statusText}`,
		ErrorType.PROVIDER_ERROR,
		response.status,
	);
}
