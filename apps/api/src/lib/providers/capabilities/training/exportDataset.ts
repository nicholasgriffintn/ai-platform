import type { ServiceContext } from "~/lib/context/serviceContext";
import type { TrainingExampleFilters } from "~/repositories/TrainingExampleRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { putSageMakerS3Object, resolveSageMakerTrainingBucket } from "./trainingS3";

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

	const targetBucket = resolveSageMakerTrainingBucket(context, bucket);
	const objectKey =
		key ||
		`training/datasets/user-${user.id}/${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
	const jsonl = examples.map(toTrainingJsonLine).join("\n") + "\n";

	await putSageMakerS3Object({
		context,
		bucket: targetBucket,
		key: objectKey,
		contentType: "application/jsonlines",
		body: jsonl,
	});

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
