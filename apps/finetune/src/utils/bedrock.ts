import type {
	GetImportedModelCommandOutput,
	GetModelCustomizationJobCommandOutput,
	GetModelImportJobCommandOutput,
} from "@aws-sdk/client-bedrock";
import type { TrainingDeployment, TrainingJob } from "@assistant/schemas";

import type { Env } from "../types/env.js";
import { isRecord } from "./objects.js";
import { splitCsv } from "./strings.js";

export function getBedrockVpcConfig(env: Env) {
	const securityGroupIds = splitCsv(env.BEDROCK_VPC_SECURITY_GROUP_IDS);
	const subnetIds = splitCsv(env.BEDROCK_VPC_SUBNET_IDS);

	if (securityGroupIds.length === 0 || subnetIds.length === 0) {
		return undefined;
	}

	return { securityGroupIds, subnetIds };
}

export function mapBedrockTrainingJob(
	response: GetModelCustomizationJobCommandOutput,
	fallbackJobName: string,
): TrainingJob {
	return {
		provider: "aws-bedrock",
		jobName: response.jobName || fallbackJobName,
		status: response.status || "Unknown",
		modelId: "unknown",
		baseModel: response.baseModelArn || "unknown",
		trainingDataS3Uri: response.trainingDataConfig?.s3Uri,
		validationDataS3Uri: response.validationDataConfig?.validators?.[0]?.s3Uri,
		outputS3Uri: response.outputDataConfig?.s3Uri,
		modelArtifactsS3Uri: response.outputModelArn,
		createdAt: response.creationTime?.toISOString(),
		startedAt: response.creationTime?.toISOString(),
		completedAt: response.endTime?.toISOString(),
		failureReason: response.failureMessage,
		providerResponse: response,
	};
}

export function mapBedrockImportDeployment(
	response: GetModelImportJobCommandOutput,
	fallbackJobName: string,
): TrainingDeployment {
	const jobName = response.jobName || fallbackJobName;
	const importedModelName = response.importedModelName || jobName;

	return {
		provider: "aws-bedrock",
		deploymentTarget: "bedrock-import",
		deploymentName: importedModelName,
		modelName: response.importedModelArn || importedModelName,
		endpointConfigName: response.jobArn || jobName,
		endpointName: jobName,
		status: response.status || "Unknown",
		modelId: "unknown",
		modelArtifactsS3Uri: response.modelDataSource?.s3DataSource?.s3Uri,
		createdAt: response.creationTime?.toISOString(),
		failureReason: response.failureMessage,
		providerResponse: response,
	};
}

export function mapBedrockImportedModelDeployment(
	response: GetImportedModelCommandOutput,
	fallbackModelName: string,
): TrainingDeployment {
	const modelName = response.modelName || fallbackModelName;
	const jobName = response.jobName || modelName;

	return {
		provider: "aws-bedrock",
		deploymentTarget: "bedrock-import",
		deploymentName: modelName,
		modelName: response.modelArn || modelName,
		endpointConfigName: response.jobArn || jobName,
		endpointName: jobName,
		status: "Completed",
		modelId: "unknown",
		modelArtifactsS3Uri: response.modelDataSource?.s3DataSource?.s3Uri,
		createdAt: response.creationTime?.toISOString(),
		providerResponse: response,
	};
}

export function getBedrockImportedModelIdentifier(
	deployment: TrainingDeployment,
): string | undefined {
	if (deployment.modelName.startsWith("arn:aws")) return deployment.modelName;
	if (isRecord(deployment.providerResponse)) {
		const importedModelArn =
			deployment.providerResponse.importedModelArn || deployment.providerResponse.modelArn;
		if (typeof importedModelArn === "string" && importedModelArn) return importedModelArn;
	}

	return deployment.modelName || deployment.deploymentName;
}

export function isBedrockResourceNotFoundError(error: unknown): boolean {
	return (
		isRecord(error) &&
		(error.name === "ResourceNotFoundException" ||
			(isRecord(error.$metadata) && error.$metadata.httpStatusCode === 404))
	);
}
