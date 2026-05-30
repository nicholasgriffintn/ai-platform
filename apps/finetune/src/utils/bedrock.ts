import type { GetModelCustomizationJobCommandOutput } from "@aws-sdk/client-bedrock";
import type { FineTuningJob } from "@assistant/schemas";

import type { Env } from "../types/env.js";
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
): FineTuningJob {
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
