import type { TrainingModelDefinition } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  hasSageMakerS3Object,
  putSageMakerS3Object,
  resolveSageMakerTrainingBucket,
} from "./trainingS3";

interface ResolveTrainingSourceOptions {
  context: ServiceContext;
  model: TrainingModelDefinition;
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
  const key = model.sourceArchive.s3Key || `training/sources/${model.id}/source.tar.gz`;
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
