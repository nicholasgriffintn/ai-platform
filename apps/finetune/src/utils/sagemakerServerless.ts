import { isSageMakerGpuImage, type TrainingDeploymentTarget } from "@assistant/schemas";

import type { DeployModelOptions } from "../types/providers.js";

export const DEFAULT_SAGEMAKER_SERVERLESS_MEMORY_SIZE_MB = 6144;
export const DEFAULT_SAGEMAKER_SERVERLESS_MAX_CONCURRENCY = 5;

export function isSageMakerServerlessDeploymentTarget(target?: TrainingDeploymentTarget): boolean {
	return target === "sagemaker-serverless-endpoint";
}

export function getSageMakerServerlessCompatibilityError(image?: string): string | undefined {
	if (!isSageMakerGpuImage(image)) return undefined;

	return "SageMaker Serverless Inference does not support the configured GPU image. Use a real-time GPU endpoint target for this model.";
}

export function getSageMakerServerlessConfig(options: DeployModelOptions): {
	MemorySizeInMB: number;
	MaxConcurrency: number;
	ProvisionedConcurrency?: number;
} {
	return {
		MemorySizeInMB: options.serverlessMemorySizeInMB || DEFAULT_SAGEMAKER_SERVERLESS_MEMORY_SIZE_MB,
		MaxConcurrency:
			options.serverlessMaxConcurrency || DEFAULT_SAGEMAKER_SERVERLESS_MAX_CONCURRENCY,
		...(options.serverlessProvisionedConcurrency
			? { ProvisionedConcurrency: options.serverlessProvisionedConcurrency }
			: {}),
	};
}
