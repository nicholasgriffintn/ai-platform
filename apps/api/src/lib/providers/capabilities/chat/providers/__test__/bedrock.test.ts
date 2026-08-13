import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { ChatCompletionParameters, IEnv } from "~/types";
import { createCommonParameters, getToolsForProvider } from "~/utils/parameters";
import { BedrockProvider } from "../bedrock";

const signMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("aws4fetch", () => ({
	AwsClient: class {
		constructor() {
			return { sign: signMock };
		}
	},
}));

vi.mock("../base", () => ({
	BaseProvider: class MockBaseProvider {
		name = "mock";
		supportsStreaming = true;
		validateAiGatewayToken() {
			return true;
		}
		validateParams() {}
		async getApiKey() {
			return "test-key";
		}
		async formatResponse(data: unknown) {
			return data;
		}
	},
}));

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/lib/monitoring", () => ({
	trackProviderMetrics: vi.fn(async ({ operation }) => operation()),
}));

vi.mock("~/utils/parameters", () => ({
	createCommonParameters: vi.fn(),
	getToolsForProvider: vi.fn(),
}));

const env = {
	AI_GATEWAY_TOKEN: "test-token",
	ACCOUNT_ID: "test-account",
	BEDROCK_AWS_ACCESS_KEY: "access",
	BEDROCK_AWS_SECRET_KEY: "secret",
} as IEnv;

function modelConfig(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
	return {
		matchingModel: "test-model",
		provider: "bedrock",
		...overrides,
	};
}

function parameters(overrides: Partial<ChatCompletionParameters> = {}): ChatCompletionParameters {
	return {
		env,
		model: "test-model",
		messages: [],
		...overrides,
	};
}

function jsonResponse(data: unknown): Response {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

class StubbedBedrockProvider extends BedrockProvider {
	override async mapParameters(): Promise<Record<string, unknown>> {
		return { body: true };
	}

	protected override async formatResponse(data: unknown): Promise<unknown> {
		return data;
	}
}

beforeAll(() => {
	vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
	vi.unstubAllGlobals();
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(createCommonParameters).mockReturnValue({
		temperature: 0.5,
		max_tokens: 128,
		top_p: 0.9,
	});
	vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });
});

describe("BedrockProvider", () => {
	it("maps video generation to Bedrock's async model input", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(
			modelConfig({ modalities: { input: ["text"], output: ["video"] } }),
		);

		const result = await new BedrockProvider().mapParameters(
			parameters({
				model: "bedrock-video",
				completion_id: "completion-123",
				messages: [{ role: "user", content: "Create a video of a sunset" }],
			}),
		);

		expect(result).toMatchObject({
			modelId: "bedrock-video",
			modelInput: {
				taskType: "TEXT_VIDEO",
				textToVideoParams: { text: "Create a video of a sunset" },
				videoGenerationConfig: {
					durationSeconds: 6,
					fps: 24,
					dimension: "1280x720",
				},
			},
			outputDataConfig: {
				s3OutputDataConfig: {
					s3Uri: "s3://polychat-embeddings/bedrock-video/completion-123/",
				},
			},
		});
	});

	it("maps image generation to Bedrock's image model input", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(
			modelConfig({ modalities: { input: ["text"], output: ["image"] } }),
		);

		const result = await new BedrockProvider().mapParameters(
			parameters({
				model: "bedrock-image",
				messages: [{ role: "user", content: "Draw a cat" }],
			}),
		);

		expect(result).toEqual({
			taskType: "TEXT_IMAGE",
			textToImageParams: { text: "Draw a cat" },
			imageGenerationConfig: {
				quality: "standard",
				width: 1280,
				height: 1280,
				numberOfImages: 1,
			},
		});
	});

	it("formats supported image and video message parts for Bedrock", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(
			modelConfig({ modalities: { input: ["text", "image", "video"], output: ["text"] } }),
		);

		const result = await new BedrockProvider().mapParameters(
			parameters({
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: "Describe these" },
							{
								type: "image_url",
								image_url: { url: "data:image/png;base64,aGVsbG8=" },
							},
							{
								type: "video_url",
								video_url: { url: "data:video/mp4;base64,QUJDRA==" },
							},
						],
					},
				],
			}),
		);

		expect(result.messages[0].content).toEqual([
			{ text: "Describe these" },
			{ image: { format: "png", source: { bytes: "aGVsbG8=" } } },
			{ video: { format: "mp4", source: { bytes: "QUJDRA==" } } },
		]);
	});

	it("routes invoke requests through the configured AI Gateway path", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(
			modelConfig({ bedrockApiOperation: "invoke" }),
		);
		signMock.mockResolvedValue(
			new Request("https://bedrock-runtime.us-east-1.amazonaws.com/model/test-model/invoke", {
				method: "POST",
			}),
		);
		fetchMock.mockResolvedValue(jsonResponse({ result: "ok" }));

		await new StubbedBedrockProvider().getResponse(parameters());

		const [forwardedInput] = fetchMock.mock.calls[0];
		expect(String(forwardedInput)).toBe(
			"https://gateway.ai.cloudflare.com/v1/test-account/llm-assistant/aws-bedrock/bedrock-runtime/us-east-1/model/test-model/invoke",
		);
	});

	it("returns resumable metadata when an async invocation starts", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(
			modelConfig({ bedrockApiOperation: "async-invoke" }),
		);
		signMock.mockResolvedValue(
			new Request("https://bedrock-runtime.us-east-1.amazonaws.com/async-invoke", {
				method: "POST",
			}),
		);
		const invocationArn = "arn:aws:bedrock:us-east-1:123456789012:async-invoke/abc";
		fetchMock.mockResolvedValue(jsonResponse({ invocationArn }));

		const result = await new StubbedBedrockProvider().getResponse(
			parameters({ model: "amazon.nova-reel-v1:1" }),
		);

		expect(result).toMatchObject({
			status: "in_progress",
			data: {
				asyncInvocation: {
					provider: "bedrock",
					id: invocationArn,
					type: "bedrock.asyncInvoke",
					pollIntervalMs: 6000,
					context: { invocationArn, region: "us-east-1" },
				},
			},
		});
	});

	it("returns the generated video location when an async invocation succeeds", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(
			modelConfig({ modalities: { input: ["text"], output: ["video"] } }),
		);
		const invocationArn = "arn:aws:bedrock:us-east-1:123456789012:async-invoke/def";
		signMock.mockResolvedValue(
			new Request(
				`https://bedrock-runtime.us-east-1.amazonaws.com/async-invoke/${encodeURIComponent(invocationArn)}`,
				{ method: "GET" },
			),
		);
		fetchMock.mockResolvedValue(
			jsonResponse({
				status: "SUCCEEDED",
				outputDataConfig: { s3OutputDataConfig: { s3Uri: "s3://bucket/result/" } },
			}),
		);

		const result = await new StubbedBedrockProvider().getAsyncInvocationStatus(
			createAsyncInvocationMetadata({
				provider: "bedrock",
				id: invocationArn,
				context: { invocationArn },
			}),
			parameters({ model: "amazon.nova-reel-v1:1" }),
		);

		expect(result.status).toBe("completed");
		expect(result.result?.response).toContain("s3://bucket/result/");
	});

	it.each([
		["IN_PROGRESS", "in_progress"],
		["FAILED", "failed"],
	] as const)("normalises async status %s to %s", async (bedrockStatus, expectedStatus) => {
		const invocationArn = "arn:aws:bedrock:us-east-1:123456789012:async-invoke/status";
		signMock.mockResolvedValue(
			new Request(
				`https://bedrock-runtime.us-east-1.amazonaws.com/async-invoke/${encodeURIComponent(invocationArn)}`,
				{ method: "GET" },
			),
		);
		fetchMock.mockResolvedValue(jsonResponse({ status: bedrockStatus }));

		const result = await new StubbedBedrockProvider().getAsyncInvocationStatus(
			createAsyncInvocationMetadata({
				provider: "bedrock",
				id: invocationArn,
				context: { invocationArn },
			}),
			parameters(),
		);

		expect(result.status).toBe(expectedStatus);
		expect(result.result).toBeUndefined();
	});
});
