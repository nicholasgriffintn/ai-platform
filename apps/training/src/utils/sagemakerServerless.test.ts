import { describe, expect, it } from "vitest";

import {
	DEFAULT_SAGEMAKER_SERVERLESS_MAX_CONCURRENCY,
	DEFAULT_SAGEMAKER_SERVERLESS_MEMORY_SIZE_MB,
	getSageMakerServerlessCompatibilityError,
	getSageMakerServerlessConfig,
	isSageMakerServerlessDeploymentTarget,
} from "./sagemakerServerless.js";

describe("SageMaker Serverless deployment helpers", () => {
	it("detects serverless deployment targets", () => {
		expect(isSageMakerServerlessDeploymentTarget("sagemaker-serverless-endpoint")).toBe(true);
		expect(isSageMakerServerlessDeploymentTarget("sagemaker-endpoint")).toBe(false);
	});

	it("rejects GPU inference images for serverless endpoints", () => {
		expect(
			getSageMakerServerlessCompatibilityError("huggingface-pytorch-tgi-inference:gpu"),
		).toContain("does not support");
		expect(
			getSageMakerServerlessCompatibilityError("huggingface-pytorch-inference:cpu"),
		).toBeUndefined();
	});

	it("builds a default serverless config", () => {
		expect(getSageMakerServerlessConfig({} as any)).toEqual({
			MemorySizeInMB: DEFAULT_SAGEMAKER_SERVERLESS_MEMORY_SIZE_MB,
			MaxConcurrency: DEFAULT_SAGEMAKER_SERVERLESS_MAX_CONCURRENCY,
		});
	});
});
