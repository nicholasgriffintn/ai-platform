import type { FineTuningModelDefinition } from "~/types/training";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	hasSageMakerS3Object,
	putSageMakerS3Object,
	resolveSageMakerTrainingBucket,
} from "./trainingS3";

interface ResolveTrainingSourceOptions {
	context: ServiceContext;
	model: FineTuningModelDefinition;
	sourceS3Uri?: string;
}

interface ResolvedTrainingSource {
	entryPoint?: string;
	sourceS3Uri?: string;
}

export async function resolveTrainingSource({
	context,
	model,
	sourceS3Uri,
}: ResolveTrainingSourceOptions): Promise<ResolvedTrainingSource> {
	if (sourceS3Uri) {
		return {
			entryPoint: model.defaultEntryPoint,
			sourceS3Uri,
		};
	}

	if (model.defaultSourceS3Uri) {
		return {
			entryPoint: model.defaultEntryPoint,
			sourceS3Uri: model.defaultSourceS3Uri,
		};
	}

	if (!model.sourceArchive) {
		return {
			entryPoint: model.defaultEntryPoint,
		};
	}

	const bucket = resolveSageMakerTrainingBucket(context);
	const key = model.sourceArchive.s3Key || `fine-tuning/sources/${model.id}/source.tar.gz`;
	const exists = await hasSageMakerS3Object({ context, bucket, key });

	if (!exists) {
		const response = await fetch(model.sourceArchive.url);
		if (!response.ok) {
			const text = await response.text();
			throw new AssistantError(
				`Failed to fetch training source archive (${response.status}): ${text || response.statusText}`,
				ErrorType.PROVIDER_ERROR,
				response.status,
			);
		}

		await putSageMakerS3Object({
			context,
			bucket,
			key,
			contentType: model.sourceArchive.contentType || "application/gzip",
			body: await response.arrayBuffer(),
		});
	}

	return {
		entryPoint: model.defaultEntryPoint,
		sourceS3Uri: `s3://${bucket}/${key}`,
	};
}
