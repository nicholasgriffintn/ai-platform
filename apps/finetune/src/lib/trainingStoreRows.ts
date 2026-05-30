import type { TrainingDeployment, TrainingJob, TrainingJobEvent } from "@assistant/schemas";
import {
	trainingJobEventSchema,
	trainingProviderSchema,
	getTrainingDeploymentChatModelId,
} from "@assistant/schemas";

import { parseJsonValue } from "../utils/json.js";
import { optionalString } from "../utils/strings.js";
import {
	getDeploymentTargetFromRequest,
	getDeploymentVersionFromRequest,
} from "../utils/trainingDeploymentVersions.js";

const trainingJobEventLevelSchema = trainingJobEventSchema.shape.level;

export function mapTrainingJobRow(row: Record<string, unknown>): TrainingJob {
	return {
		provider: trainingProviderSchema.parse(row.provider),
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

export function mapTrainingDeploymentRow(row: Record<string, unknown>): TrainingDeployment {
	const request = parseJsonValue(row.request_json);
	const provider = trainingProviderSchema.parse(row.provider);
	const endpointName = String(row.endpoint_name ?? "");

	return {
		provider,
		deploymentName: String(row.deployment_name ?? ""),
		deploymentTarget: getDeploymentTargetFromRequest(request),
		deploymentVersion: getDeploymentVersionFromRequest(request),
		modelName: String(row.model_name ?? ""),
		endpointConfigName: String(row.endpoint_config_name ?? ""),
		endpointName,
		chatModelId: endpointName
			? getTrainingDeploymentChatModelId({ provider, endpointName })
			: undefined,
		status: String(row.status ?? "Unknown"),
		modelId: String(row.model_id ?? "unknown"),
		modelArtifactsS3Uri: optionalString(row.model_artifacts_s3_uri),
		failureReason: optionalString(row.failure_reason),
		createdAt: optionalString(row.created_at),
		providerResponse: parseJsonValue(row.response_json),
	};
}

export function mapTrainingJobEventRow(row: Record<string, unknown>): TrainingJobEvent {
	return {
		id: String(row.id ?? ""),
		provider: trainingProviderSchema.parse(row.provider),
		jobName: String(row.job_name ?? ""),
		level: trainingJobEventLevelSchema.parse(row.level || "info"),
		message: String(row.message ?? ""),
		metadata: parseJsonValue(row.metadata_json),
		createdAt: String(row.created_at ?? ""),
	};
}
