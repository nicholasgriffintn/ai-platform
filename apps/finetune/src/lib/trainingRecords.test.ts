import { describe, expect, it } from "vitest";

import { mergeTrainingDeployment } from "./trainingRecords.js";

describe("mergeTrainingDeployment", () => {
	it("settles a stale endpoint update when SageMaker reports the old config in service", () => {
		const deployment = mergeTrainingDeployment(
			{
				provider: "aws-sagemaker",
				deploymentName: "polychat-lizzy-7b",
				deploymentVersion: "1.1",
				modelName: "polychat-lizzy-7b-1-1-model",
				endpointConfigName: "polychat-lizzy-7b-1-1-config",
				endpointName: "polychat-lizzy-7b-endpoint",
				status: "Updating",
				modelId: "polychat-lizzy-7b",
			},
			{
				provider: "aws-sagemaker",
				deploymentName: "polychat-lizzy-7b-endpoint",
				modelName: "polychat-lizzy-7b-config",
				endpointConfigName: "polychat-lizzy-7b-config",
				endpointName: "polychat-lizzy-7b-endpoint",
				status: "InService",
				modelId: "unknown",
			},
		);

		expect(deployment).toMatchObject({
			status: "InService",
			modelName: "polychat-lizzy-7b-config",
			endpointConfigName: "polychat-lizzy-7b-config",
			modelId: "polychat-lizzy-7b",
		});
	});

	it("keeps an active endpoint update while SageMaker is still updating the old config", () => {
		const deployment = mergeTrainingDeployment(
			{
				provider: "aws-sagemaker",
				deploymentName: "polychat-lizzy-7b",
				deploymentVersion: "1.1",
				modelName: "polychat-lizzy-7b-1-1-model",
				endpointConfigName: "polychat-lizzy-7b-1-1-config",
				endpointName: "polychat-lizzy-7b-endpoint",
				status: "Updating",
				modelId: "polychat-lizzy-7b",
			},
			{
				provider: "aws-sagemaker",
				deploymentName: "polychat-lizzy-7b-endpoint",
				modelName: "polychat-lizzy-7b-config",
				endpointConfigName: "polychat-lizzy-7b-config",
				endpointName: "polychat-lizzy-7b-endpoint",
				status: "Updating",
				modelId: "unknown",
			},
		);

		expect(deployment).toMatchObject({
			status: "Updating",
			modelName: "polychat-lizzy-7b-1-1-model",
			endpointConfigName: "polychat-lizzy-7b-1-1-config",
			modelId: "polychat-lizzy-7b",
		});
	});

	it("marks an endpoint update in service when SageMaker reports the target config", () => {
		const deployment = mergeTrainingDeployment(
			{
				provider: "aws-sagemaker",
				deploymentName: "polychat-lizzy-7b",
				deploymentVersion: "1.1",
				modelName: "polychat-lizzy-7b-1-1-model",
				endpointConfigName: "polychat-lizzy-7b-1-1-config",
				endpointName: "polychat-lizzy-7b-endpoint",
				status: "Updating",
				modelId: "polychat-lizzy-7b",
			},
			{
				provider: "aws-sagemaker",
				deploymentName: "polychat-lizzy-7b-endpoint",
				modelName: "polychat-lizzy-7b-1-1-config",
				endpointConfigName: "polychat-lizzy-7b-1-1-config",
				endpointName: "polychat-lizzy-7b-endpoint",
				status: "InService",
				modelId: "unknown",
			},
		);

		expect(deployment).toMatchObject({
			status: "InService",
			modelName: "polychat-lizzy-7b-1-1-model",
			endpointConfigName: "polychat-lizzy-7b-1-1-config",
			modelId: "polychat-lizzy-7b",
		});
	});

	it("keeps a failed endpoint update when SageMaker still reports the old config", () => {
		const deployment = mergeTrainingDeployment(
			{
				provider: "aws-sagemaker",
				deploymentName: "polychat-lizzy-7b",
				deploymentVersion: "1.4",
				modelName: "polychat-lizzy-7b-v1-4-model",
				endpointConfigName: "polychat-lizzy-7b-v1-4-config",
				endpointName: "polychat-lizzy-7b-endpoint",
				status: "Failed",
				modelId: "polychat-lizzy-7b",
				failureReason: "UpdateEndpoint failed",
			},
			{
				provider: "aws-sagemaker",
				deploymentName: "polychat-lizzy-7b-endpoint",
				modelName: "polychat-lizzy-7b-config",
				endpointConfigName: "polychat-lizzy-7b-config",
				endpointName: "polychat-lizzy-7b-endpoint",
				status: "InService",
				modelId: "unknown",
			},
		);

		expect(deployment).toMatchObject({
			status: "Failed",
			modelName: "polychat-lizzy-7b-v1-4-model",
			endpointConfigName: "polychat-lizzy-7b-v1-4-config",
			modelId: "polychat-lizzy-7b",
			failureReason: "UpdateEndpoint failed",
		});
	});
});
