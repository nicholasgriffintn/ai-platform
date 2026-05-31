import type { TrainingModelDefinition } from "@assistant/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SageMakerTrainingProvider } from "./SageMakerTrainingProvider.js";

const fetchMock = vi.fn<typeof fetch>();

const MODEL: TrainingModelDefinition = {
	id: "polychat-lizzy-7b",
	provider: "aws-sagemaker",
	family: "huggingface",
	name: "Lizzy 7B",
	baseModel: "flwrlabs/Lizzy-7B",
	defaultHyperparameters: {},
	inferenceImage: "123456789012.dkr.ecr.us-east-1.amazonaws.com/huggingface-cpu:latest",
	defaultDeploymentInstanceType: "ml.m5.large",
};

const VLLM_MODEL: TrainingModelDefinition = {
	...MODEL,
	inferenceImage:
		"763104351884.dkr.ecr.us-east-1.amazonaws.com/vllm:0.20.2-gpu-py312-cu130-ubuntu22.04-sagemaker",
	inferenceRuntime: "sagemaker-openai",
	defaultDeploymentInstanceType: "ml.g4dn.xlarge",
	defaultDeploymentEnvironment: {
		SM_VLLM_TENSOR_PARALLEL_SIZE: "1",
		SM_VLLM_MAX_NUM_SEQS: "4",
	},
};

describe("SageMakerTrainingProvider", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
		fetchMock.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("creates versioned model resources behind a stable endpoint", async () => {
		fetchMock.mockImplementation(async () => createAwsResponse({}));

		const result = await createProvider().deployModel({
			model: MODEL,
			deploymentName: "polychat-lizzy-7b",
			deploymentVersion: "1.1",
			environment: { HF_MODEL_ID: "flwrlabs/Lizzy-7B" },
		});

		expect(getAwsTargets()).toEqual([
			"SageMaker.CreateModel",
			"SageMaker.CreateEndpointConfig",
			"SageMaker.CreateEndpoint",
		]);
		expect(result.deployment).toMatchObject({
			deploymentName: "polychat-lizzy-7b",
			modelName: "polychat-lizzy-7b-1-1-model",
			endpointConfigName: "polychat-lizzy-7b-1-1-config",
			endpointName: "polychat-lizzy-7b-endpoint",
			status: "Creating",
		});
		expect(result.deployment.providerResponse).toMatchObject({
			endpointOperation: "create",
		});
	});

	it("updates an existing endpoint to the new endpoint config", async () => {
		fetchMock
			.mockResolvedValueOnce(createAwsResponse({}))
			.mockResolvedValueOnce(createAwsResponse({}))
			.mockResolvedValueOnce(
				createAwsResponse(
					{ message: "Cannot create already existing endpoint polychat-lizzy-7b-endpoint" },
					400,
				),
			)
			.mockResolvedValueOnce(createAwsResponse({}));

		const result = await createProvider().deployModel({
			model: MODEL,
			deploymentName: "polychat-lizzy-7b",
			deploymentVersion: "1.1",
			environment: { HF_MODEL_ID: "flwrlabs/Lizzy-7B" },
		});

		expect(getAwsTargets()).toEqual([
			"SageMaker.CreateModel",
			"SageMaker.CreateEndpointConfig",
			"SageMaker.CreateEndpoint",
			"SageMaker.UpdateEndpoint",
		]);
		expect(getAwsBodies()[3]).toEqual({
			EndpointName: "polychat-lizzy-7b-endpoint",
			EndpointConfigName: "polychat-lizzy-7b-1-1-config",
		});
		expect(result.deployment).toMatchObject({
			status: "Updating",
			endpointName: "polychat-lizzy-7b-endpoint",
			endpointConfigName: "polychat-lizzy-7b-1-1-config",
		});
		expect(result.deployment.providerResponse).toMatchObject({
			endpointOperation: "update",
		});
	});

	it("sets runtime infrastructure for SageMaker vLLM deployments", async () => {
		fetchMock.mockImplementation(async () => createAwsResponse({}));

		await createProvider().deployModel({
			model: VLLM_MODEL,
			deploymentName: "polychat-lizzy-7b",
			environment: { HF_MODEL_ID: "flwrlabs/Lizzy-7B" },
		});

		expect(getAwsBodies()[1]).toMatchObject({
			EndpointConfigName: "polychat-lizzy-7b-config",
			ProductionVariants: [
				{
					VariantName: "AllTraffic",
					InstanceType: "ml.g4dn.xlarge",
					InferenceAmiVersion: "al2023-ami-sagemaker-inference-gpu-4-1",
					ContainerStartupHealthCheckTimeoutInSeconds: 1800,
					ModelDataDownloadTimeoutInSeconds: 1800,
				},
			],
		});
	});
});

function createProvider(): SageMakerTrainingProvider {
	return new SageMakerTrainingProvider({
		AWS_REGION: "us-east-1",
		AWS_ACCESS_KEY_ID: "access-key",
		AWS_SECRET_ACCESS_KEY: "secret-key",
		SAGEMAKER_ROLE_ARN: "arn:aws:iam::123456789012:role/sagemaker-execution-role",
	});
}

function createAwsResponse(body: Record<string, unknown>, status = 200): Response {
	return new Response(JSON.stringify(body), { status });
}

function getAwsTargets(): (string | null)[] {
	return fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers).get("X-Amz-Target"));
}

function getAwsBodies(): unknown[] {
	return fetchMock.mock.calls.map(([, init]) => {
		if (typeof init?.body !== "string") return undefined;

		return JSON.parse(init.body);
	});
}
