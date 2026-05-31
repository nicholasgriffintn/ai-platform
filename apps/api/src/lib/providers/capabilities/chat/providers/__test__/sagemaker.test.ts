import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSageMakerTrainingDeploymentRuntimeRecordByEndpointName } from "~/lib/providers/models/trainingDeployments";
import { SageMakerProvider } from "../sagemaker";

const { fetchMock } = vi.hoisted(() => ({
	fetchMock: vi.fn(),
}));

vi.mock("aws4fetch", () => ({
	AwsClient: vi.fn().mockImplementation(function AwsClient() {
		return { fetch: fetchMock };
	}),
}));

vi.mock("~/lib/providers/models/trainingDeployments", () => ({
	getSageMakerTrainingDeploymentRuntimeRecordByEndpointName: vi.fn(),
}));

vi.mock("~/lib/monitoring", () => ({
	trackProviderMetrics: vi.fn(async ({ operation }) => operation()),
}));

const env = {
	SAGEMAKER_AWS_ACCESS_KEY: "test-key",
	SAGEMAKER_AWS_SECRET_KEY: "test-secret",
	SAGEMAKER_AWS_REGION: "us-east-1",
};

describe("SageMakerProvider", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.mocked(getSageMakerTrainingDeploymentRuntimeRecordByEndpointName).mockReset();
	});

	it("uses the OpenAI-compatible request shape for vLLM-backed training deployments", async () => {
		vi.mocked(getSageMakerTrainingDeploymentRuntimeRecordByEndpointName).mockResolvedValue({
			provider: "aws-sagemaker",
			endpointName: "lizzy-7b-endpoint",
			deploymentName: "lizzy-7b",
			status: "InService",
			modelId: "lizzy-7b",
		});
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ choices: [{ message: { content: "Ready" } }] }), {
				status: 200,
			}),
		);

		const provider = new SageMakerProvider();
		const result = await provider.getResponse(
			{
				model: "lizzy-7b-endpoint",
				messages: [{ role: "user", content: "Hello" }],
				max_tokens: 64,
				temperature: 0.2,
				top_p: 0.9,
				env,
			} as any,
			1,
		);

		const request = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(request).toEqual({
			model: "flwrlabs/Lizzy-7B",
			messages: [{ role: "user", content: "Hello" }],
			max_tokens: 64,
			temperature: 0.2,
			top_p: 0.9,
			stream: false,
		});
		expect(result.response).toBe("Ready");
	});

	it("keeps the Hugging Face pipeline request shape for default SageMaker deployments", async () => {
		vi.mocked(getSageMakerTrainingDeploymentRuntimeRecordByEndpointName).mockResolvedValue({
			provider: "aws-sagemaker",
			endpointName: "custom-endpoint",
			deploymentName: "custom",
			status: "InService",
			modelId: "custom-model",
		});
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify([{ generated_text: "Generated" }]), { status: 200 }),
		);

		const provider = new SageMakerProvider();
		const result = await provider.getResponse(
			{
				model: "custom-endpoint",
				messages: [{ role: "user", content: "Hello" }],
				max_tokens: 32,
				env,
			} as any,
			1,
		);

		const request = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(request).toEqual({
			inputs: "User: Hello\nAssistant:",
			parameters: {
				max_new_tokens: 32,
				return_full_text: false,
			},
		});
		expect(result.response).toBe("Generated");
	});
});
