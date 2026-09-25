import type {
  TrainingDeployment,
  TrainingJob,
  TrainingJobEvent,
} from "@ngriffin_uk/polychat-schemas";
import {
  trainingJobEventSchema,
  trainingProviderSchema,
  getTrainingDeploymentChatModelId,
} from "@ngriffin_uk/polychat-schemas";

import { parseJsonValue } from "../utils/json.js";
import { optionalString, toStringValue } from "../utils/strings.js";
import {
  getDeploymentTargetFromRequest,
  getDeploymentVersionFromRequest,
} from "../utils/trainingDeploymentVersions.js";

const trainingJobEventLevelSchema = trainingJobEventSchema.shape.level;

export function mapTrainingJobRow(row: Record<string, unknown>): TrainingJob {
  return {
    provider: trainingProviderSchema.parse(row.provider),
    jobName: toStringValue(row.job_name ?? "", ""),
    providerJobId: optionalString(row.provider_job_id),
    status: toStringValue(row.status ?? "Unknown", "Unknown"),
    modelId: toStringValue(row.model_id ?? "unknown", "unknown"),
    baseModel: toStringValue(row.base_model ?? "unknown", "unknown"),
    trainingImage: optionalString(row.training_image),
    trainingDataS3Uri: optionalString(row.training_data_s3_uri),
    validationDataS3Uri: optionalString(row.validation_data_s3_uri),
    outputS3Uri: optionalString(row.output_s3_uri),
    modelArtifactsS3Uri: optionalString(row.model_artifacts_s3_uri),
    failureReason: optionalString(row.failure_reason),
    createdAt: optionalString(row.created_at),
    providerResponse: parseJsonValue(row.response_json),
  };
}

export function mapTrainingDeploymentRow(row: Record<string, unknown>): TrainingDeployment {
  const request = parseJsonValue(row.request_json);
  const provider = trainingProviderSchema.parse(row.provider);
  const endpointName = toStringValue(row.endpoint_name ?? "", "");

  return {
    provider,
    deploymentName: toStringValue(row.deployment_name ?? "", ""),
    deploymentTarget: getDeploymentTargetFromRequest(request),
    deploymentVersion: getDeploymentVersionFromRequest(request),
    modelName: toStringValue(row.model_name ?? "", ""),
    endpointConfigName: toStringValue(row.endpoint_config_name ?? "", ""),
    endpointName,
    chatModelId: endpointName
      ? getTrainingDeploymentChatModelId({ provider, endpointName })
      : undefined,
    status: toStringValue(row.status ?? "Unknown", "Unknown"),
    modelId: toStringValue(row.model_id ?? "unknown", "unknown"),
    modelArtifactsS3Uri: optionalString(row.model_artifacts_s3_uri),
    failureReason: optionalString(row.failure_reason),
    createdAt: optionalString(row.created_at),
    providerResponse: parseJsonValue(row.response_json),
  };
}

export function mapTrainingJobEventRow(row: Record<string, unknown>): TrainingJobEvent {
  return {
    id: toStringValue(row.id ?? "", ""),
    provider: trainingProviderSchema.parse(row.provider),
    jobName: toStringValue(row.job_name ?? "", ""),
    level: trainingJobEventLevelSchema.parse(row.level || "info"),
    message: toStringValue(row.message ?? "", ""),
    metadata: parseJsonValue(row.metadata_json),
    createdAt: toStringValue(row.created_at ?? "", ""),
  };
}
