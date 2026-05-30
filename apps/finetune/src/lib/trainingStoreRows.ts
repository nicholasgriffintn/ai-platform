import type { FineTunedDeployment, FineTuningJob, FineTuningJobEvent } from "@assistant/schemas";
import { fineTuningJobEventSchema, fineTuningProviderSchema } from "@assistant/schemas";

import { parseJsonValue } from "../utils/json.js";
import { optionalString } from "../utils/strings.js";

const fineTuningJobEventLevelSchema = fineTuningJobEventSchema.shape.level;

export function mapTrainingJobRow(row: Record<string, unknown>): FineTuningJob {
	return {
		provider: fineTuningProviderSchema.parse(row.provider),
		jobName: String(row.job_name ?? ""),
		status: String(row.status ?? "Unknown"),
		modelId: String(row.model_id ?? "unknown"),
		baseModel: String(row.base_model ?? "unknown"),
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

export function mapTrainingDeploymentRow(row: Record<string, unknown>): FineTunedDeployment {
	return {
		provider: fineTuningProviderSchema.parse(row.provider),
		deploymentName: String(row.deployment_name ?? ""),
		modelName: String(row.model_name ?? ""),
		endpointConfigName: String(row.endpoint_config_name ?? ""),
		endpointName: String(row.endpoint_name ?? ""),
		status: String(row.status ?? "Unknown"),
		modelId: String(row.model_id ?? "unknown"),
		modelArtifactsS3Uri: optionalString(row.model_artifacts_s3_uri),
		failureReason: optionalString(row.failure_reason),
		createdAt: optionalString(row.created_at),
		providerResponse: parseJsonValue(row.response_json),
	};
}

export function mapTrainingJobEventRow(row: Record<string, unknown>): FineTuningJobEvent {
	return {
		id: String(row.id ?? ""),
		provider: fineTuningProviderSchema.parse(row.provider),
		jobName: String(row.job_name ?? ""),
		level: fineTuningJobEventLevelSchema.parse(row.level || "info"),
		message: String(row.message ?? ""),
		metadata: parseJsonValue(row.metadata_json),
		createdAt: String(row.created_at ?? ""),
	};
}
