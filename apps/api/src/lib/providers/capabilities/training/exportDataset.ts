import { AwsClient } from "aws4fetch";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { TrainingExampleFilters } from "~/repositories/TrainingExampleRepository";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface ExportTrainingDatasetOptions {
	context: ServiceContext;
	filters?: TrainingExampleFilters;
	bucket?: string;
	key?: string;
}

export interface ExportTrainingDatasetResult {
	s3Uri: string;
	bucket: string;
	key: string;
	exampleCount: number;
}

export async function exportTrainingExamplesToS3({
	context,
	filters = {},
	bucket,
	key,
}: ExportTrainingDatasetOptions): Promise<ExportTrainingDatasetResult> {
	const user = context.requireUser();
	const effectiveFilters: TrainingExampleFilters = {
		...filters,
		userId: user.id,
		includeInTraining: true,
		limit: filters.limit || 1000,
	};
	const examples = await context.repositories.trainingExamples.findMany(effectiveFilters);

	if (examples.length === 0) {
		throw new AssistantError(
			"No training examples matched the requested filters",
			ErrorType.NOT_FOUND,
		);
	}

	const region = context.env.SAGEMAKER_AWS_REGION || context.env.AWS_REGION || "us-east-1";
	const targetBucket = bucket || context.env.SAGEMAKER_BUCKET;
	if (!targetBucket) {
		throw new AssistantError(
			"Missing SAGEMAKER_BUCKET for dataset export",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const objectKey =
		key ||
		`fine-tuning/datasets/user-${user.id}/${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
	const jsonl = examples.map(toTrainingJsonLine).join("\n") + "\n";

	const accessKeyId =
		context.env.SAGEMAKER_AWS_ACCESS_KEY || context.env.ASSETS_BUCKET_ACCESS_KEY_ID;
	const secretAccessKey =
		context.env.SAGEMAKER_AWS_SECRET_KEY || context.env.ASSETS_BUCKET_SECRET_ACCESS_KEY;
	if (!accessKeyId || !secretAccessKey) {
		throw new AssistantError(
			"Missing AWS credentials for S3 dataset export",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const aws = new AwsClient({ accessKeyId, secretAccessKey, region, service: "s3" });
	const response = await aws.fetch(
		`https://${targetBucket}.s3.${region}.amazonaws.com/${encodeS3Key(objectKey)}`,
		{
			method: "PUT",
			headers: {
				"Content-Type": "application/jsonlines",
			},
			body: jsonl,
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new AssistantError(
			`Failed to upload training dataset to S3 (${response.status}): ${text || response.statusText}`,
			ErrorType.PROVIDER_ERROR,
			response.status,
		);
	}

	const exportedIds = examples
		.map((example) => (typeof example.id === "string" ? example.id : undefined))
		.filter((id): id is string => Boolean(id));
	await context.repositories.trainingExamples.markAsExported(exportedIds);

	return {
		s3Uri: `s3://${targetBucket}/${objectKey}`,
		bucket: targetBucket,
		key: objectKey,
		exampleCount: examples.length,
	};
}

function toTrainingJsonLine(example: Record<string, any>): string {
	return JSON.stringify({
		messages: [
			...(example.system_prompt
				? [{ role: "system", content: String(example.system_prompt) }]
				: []),
			{ role: "user", content: String(example.user_prompt || "") },
			{ role: "assistant", content: String(example.assistant_response || "") },
		],
		metadata: {
			id: example.id,
			source: example.source,
			appName: example.app_name,
			modelUsed: example.model_used,
			feedbackRating: example.feedback_rating,
			qualityScore: example.quality_score,
		},
	});
}

function encodeS3Key(key: string): string {
	return key.split("/").map(encodeURIComponent).join("/");
}
