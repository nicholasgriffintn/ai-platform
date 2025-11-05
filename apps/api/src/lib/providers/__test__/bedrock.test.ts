import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { gatewayId } from "~/constants/app";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { createAsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import { BedrockProvider } from "../provider/bedrock";
import type { ChatCompletionParameters } from "~/types";
import {
	createCommonParameters,
	getToolsForProvider,
} from "~/utils/parameters";

const signMock = vi.fn();
const fetchMock = vi.fn();

const createSignedRequest = (url: string, init: RequestInit = {}) =>
	new Request(url, {
		method: init.method || "GET",
		headers: init.headers,
		body: init.body as BodyInit | null | undefined,
	});

vi.mock("aws4fetch", () => ({
	AwsClient: vi.fn().mockImplementation(() => ({
		sign: signMock,
	})),
}));

vi.mock("~/lib/providers/provider/base", () => ({
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
		async formatResponse(data: any) {
			return data;
		}
	},
}));

vi.mock("~/lib/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/lib/monitoring", () => ({
	trackProviderMetrics: vi.fn(async ({ operation }) => operation()),
}));

vi.mock("~/utils/parameters", () => ({
	createCommonParameters: vi.fn(),
	getToolsForProvider: vi.fn(),
}));

beforeAll(() => {
	vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
	vi.unstubAllGlobals();
});

beforeEach(() => {
	fetchMock.mockReset();
	signMock.mockReset();
	vi.mocked(createCommonParameters).mockReset();
	vi.mocked(getToolsForProvider).mockReset();
});

describe("BedrockProvider", () => {
	beforeEach(() => {
		vi.mocked(getModelConfigByMatchingModel).mockReset();
	});

	describe("mapParameters", () => {
		it("should handle video generation in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "bedrock-video",
				type: ["text-to-video"],
			});

			const provider = new BedrockProvider();

			const params = {
				model: "bedrock-video",
				messages: [{ role: "user", content: "Create a video of a sunset" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
				completion_id: "completion-123",
			};

			const result = await provider.mapParameters(params as any);

			expect(result.modelId).toBe("bedrock-video");
			expect(result.modelInput).toEqual({
				taskType: "TEXT_VIDEO",
				textToVideoParams: {
					text: "Create a video of a sunset",
				},
				videoGenerationConfig: {
					durationSeconds: 6,
					fps: 24,
					dimension: "1280x720",
				},
			});
			expect(result.outputDataConfig).toEqual({
				s3OutputDataConfig: {
					s3Uri: "s3://polychat-embeddings/bedrock-video/completion-123/",
				},
			});
		});

		it("should handle image generation in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "bedrock-image",
				type: ["text-to-image"],
			});

			const provider = new BedrockProvider();

			const params = {
				model: "bedrock-image",
				messages: [{ role: "user", content: "Draw a cat" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			};

			const result = await provider.mapParameters(params as any);

			expect(result.taskType).toBe("TEXT_IMAGE");
			expect(result.textToImageParams.text).toBe("Draw a cat");
			expect(result.imageGenerationConfig).toEqual({
				quality: "standard",
				width: 1280,
				height: 1280,
				numberOfImages: 1,
			});
		});

		it("should format multimodal image content for bedrock", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "bedrock-multimodal",
				type: ["text"],
				supportsToolCalls: false,
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				temperature: 0.5,
				max_tokens: 128,
				top_p: 0.9,
			} as any);

			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] } as any);

			const provider = new BedrockProvider();

			const params = {
				model: "bedrock-multimodal",
				messages: [
					{
						role: "user",
						content: [
							{ text: "Describe the picture" },
							{
								type: "image_url",
								image_url: {
									url: "data:image/png;base64,aGVsbG8=",
								},
							},
						],
					},
				],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			};

			const result = await provider.mapParameters(params as any);

			expect(result.messages[0].content).toEqual([
				{ text: "Describe the picture" },
				{
					image: {
						format: "png",
						source: { bytes: "aGVsbG8=" },
					},
				},
			]);
		});

		it("should format multimodal video content for bedrock", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "bedrock-multimodal",
				type: ["text"],
				supportsToolCalls: false,
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				temperature: 0.5,
				max_tokens: 128,
				top_p: 0.9,
			} as any);

			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] } as any);

			const provider = new BedrockProvider();

			const params = {
				model: "bedrock-multimodal",
				messages: [
					{
						role: "user",
						content: [
							{
								type: "video_url",
								video_url: {
									url: "data:video/mp4;base64,QUJDRA==",
								},
							},
						],
					},
				],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			};

			const result = await provider.mapParameters(params as any);

			expect(result.messages[0].content).toEqual([
				{
					video: {
						format: "mp4",
						source: { bytes: "QUJDRA==" },
					},
				},
			]);
		});
	});

	describe("parseAwsCredentials", () => {
		it("should parse AWS credentials correctly", async () => {
			const provider = new BedrockProvider();

			// Test valid credentials format
			const validCredentials = "AKIATEST123::@@::secretkey456";
			// @ts-ignore - accessing private method for testing
			const parsed = provider.parseAwsCredentials(validCredentials);

			expect(parsed.accessKey).toBe("AKIATEST123");
			expect(parsed.secretKey).toBe("secretkey456");

			const invalidCredentials = "invalid-format";
			expect(() => {
				// @ts-ignore - accessing private method for testing
				provider.parseAwsCredentials(invalidCredentials);
			}).toThrow("Invalid AWS credentials format");
		});
	});

	describe("getEndpoint", () => {
		it("should use invoke endpoint for nova-canvas", async () => {
			const actualModels =
				await vi.importActual<typeof import("~/lib/models")>("~/lib/models");

			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockImplementation((model) =>
				actualModels.getModelConfigByMatchingModel(model),
			);

			const provider = new BedrockProvider();

			const endpoint = await (provider as any).getEndpoint({
				model: "amazon.nova-canvas-v1:0",
				stream: false,
				env: { AI_GATEWAY_TOKEN: "test-token" },
			});

			expect(endpoint).toBe(
				"https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-canvas-v1:0/invoke",
			);
		}, 10000);

		it("should use async-invoke endpoint for nova-reel", async () => {
			const actualModels =
				await vi.importActual<typeof import("~/lib/models")>("~/lib/models");

			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockImplementation((model) =>
				actualModels.getModelConfigByMatchingModel(model),
			);

			const provider = new BedrockProvider();

			const endpoint = await (provider as any).getEndpoint({
				model: "amazon.nova-reel-v1:1",
				stream: false,
				env: { AI_GATEWAY_TOKEN: "test-token" },
			});

			expect(endpoint).toBe(
				"https://bedrock-runtime.us-east-1.amazonaws.com/async-invoke",
			);
		});
	});

	describe("getResponse", () => {
		it("should use bedrockApiOperation for invoke requests", async () => {
			const provider = new BedrockProvider();
			// @ts-ignore - overriding protected method for testing
			provider.mapParameters = vi.fn().mockResolvedValue({ body: true });
			// @ts-ignore - overriding protected method for testing
			provider.formatResponse = vi.fn().mockResolvedValue({ formatted: true });

			const params = {
				model: "test-model",
				messages: [],
				env: {
					AI_GATEWAY_TOKEN: "token",
					ACCOUNT_ID: "test-account",
					BEDROCK_AWS_ACCESS_KEY: "access",
					BEDROCK_AWS_SECRET_KEY: "secret",
				},
			};

			fetchMock.mockResolvedValue({
				ok: true,
				json: async () => ({ result: "ok" }),
				text: async () => "",
				headers: new Headers(),
			});

			signMock.mockResolvedValue({
				url: "https://bedrock-runtime.us-east-1.amazonaws.com/model/test-model/invoke",
				headers: new Headers(),
			});

			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				bedrockApiOperation: "invoke",
			});

			await provider.getResponse(params as any);

			expect(signMock).toHaveBeenCalledWith(
				"https://bedrock-runtime.us-east-1.amazonaws.com/model/test-model/invoke",
				expect.objectContaining({ method: "POST" }),
			);

			const forwardedUrl = fetchMock.mock.calls[0][0] as URL;
			expect(forwardedUrl.toString()).toBe(
				`https://gateway.ai.cloudflare.com/v1/test-account/${gatewayId}/aws-bedrock/bedrock-runtime/us-east-1/model/test-model/invoke`,
			);
		});

		it("should return async invocation metadata for async invoke operations", async () => {
			const provider = new BedrockProvider();
			// @ts-ignore - overriding protected method for testing
			provider.mapParameters = vi.fn().mockResolvedValue({ body: true });

			const params = {
				model: "amazon.nova-reel-v1:1",
				messages: [],
				env: {
					AI_GATEWAY_TOKEN: "token",
					ACCOUNT_ID: "test-account",
					BEDROCK_AWS_ACCESS_KEY: "access",
					BEDROCK_AWS_SECRET_KEY: "secret",
				},
			};

			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				bedrockApiOperation: "async-invoke",
			});

			signMock.mockResolvedValueOnce(
				createSignedRequest(
					"https://bedrock-runtime.us-east-1.amazonaws.com/async-invoke",
					{
						method: "POST",
						headers: new Headers(),
						body: JSON.stringify({ body: true }),
					},
				),
			);

			const invocationArn =
				"arn:aws:bedrock:us-east-1:123456789012:async-invoke/abc";

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					invocationArn,
				}),
				text: async () => "",
				headers: new Headers(),
			});

			const result = await provider.getResponse(params as any);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(result.status).toBe("in_progress");
			expect(Array.isArray(result.response)).toBe(true);
			expect(result.data?.asyncInvocation).toEqual(
				expect.objectContaining({
					provider: "bedrock",
					id: invocationArn,
					type: "bedrock.asyncInvoke",
					pollIntervalMs: 6000,
					contentHints: expect.objectContaining({
						placeholder: expect.any(Array),
						failure: expect.any(Array),
					}),
					context: expect.objectContaining({
						invocationArn,
						region: "us-east-1",
					}),
				}),
			);
		});

		it("should return completed status when async invocation succeeds", async () => {
			const provider = new BedrockProvider();
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				type: ["text-to-video"],
			});
			const params = {
				model: "amazon.nova-reel-v1:1",
				env: {
					AI_GATEWAY_TOKEN: "token",
					ACCOUNT_ID: "test-account",
					BEDROCK_AWS_ACCESS_KEY: "access",
					BEDROCK_AWS_SECRET_KEY: "secret",
				},
			} as unknown as ChatCompletionParameters;

			const invocationArn =
				"arn:aws:bedrock:us-east-1:123456789012:async-invoke/def";

			signMock.mockResolvedValueOnce(
				createSignedRequest(
					`https://bedrock-runtime.us-east-1.amazonaws.com/async-invoke/${encodeURIComponent(invocationArn)}`,
					{
						method: "GET",
						headers: new Headers(),
					},
				),
			);

			const pollData = {
				status: "SUCCEEDED",
				outputDataConfig: {
					s3OutputDataConfig: {
						s3Uri: "s3://bucket/result/",
					},
				},
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => pollData,
				text: async () => "",
				headers: new Headers(),
			});

			const metadata = createAsyncInvocationMetadata({
				provider: "bedrock",
				id: invocationArn,
				context: {
					invocationArn,
				},
			});

			const result = await provider.getAsyncInvocationStatus(metadata, params);

			expect(result.status).toBe("completed");
			expect(result.result?.response).toContain("s3://bucket/result/");
			expect(signMock).toHaveBeenCalledTimes(1);
		});

		it("should return in_progress when async invocation is still running", async () => {
			const provider = new BedrockProvider();
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				type: ["text-to-video"],
			});
			const params = {
				model: "amazon.nova-reel-v1:1",
				env: {
					AI_GATEWAY_TOKEN: "token",
					ACCOUNT_ID: "test-account",
					BEDROCK_AWS_ACCESS_KEY: "access",
					BEDROCK_AWS_SECRET_KEY: "secret",
				},
			} as unknown as ChatCompletionParameters;

			const invocationArn =
				"arn:aws:bedrock:us-east-1:123456789012:async-invoke/ghi";

			signMock.mockResolvedValueOnce(
				createSignedRequest(
					`https://bedrock-runtime.us-east-1.amazonaws.com/async-invoke/${encodeURIComponent(invocationArn)}`,
					{
						method: "GET",
						headers: new Headers(),
					},
				),
			);

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ status: "IN_PROGRESS" }),
				text: async () => "",
				headers: new Headers(),
			});

			const metadata = createAsyncInvocationMetadata({
				provider: "bedrock",
				id: invocationArn,
				context: {
					invocationArn,
				},
			});

			const result = await provider.getAsyncInvocationStatus(metadata, params);

			expect(result.status).toBe("in_progress");
			expect(result.result).toBeUndefined();
		});

		it("should return failed when async invocation fails", async () => {
			const provider = new BedrockProvider();
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				type: ["text-to-video"],
			});
			const params = {
				model: "amazon.nova-reel-v1:1",
				env: {
					AI_GATEWAY_TOKEN: "token",
					ACCOUNT_ID: "test-account",
					BEDROCK_AWS_ACCESS_KEY: "access",
					BEDROCK_AWS_SECRET_KEY: "secret",
				},
			} as unknown as ChatCompletionParameters;

			const invocationArn =
				"arn:aws:bedrock:us-east-1:123456789012:async-invoke/jkl";

			signMock.mockResolvedValueOnce(
				createSignedRequest(
					`https://bedrock-runtime.us-east-1.amazonaws.com/async-invoke/${encodeURIComponent(invocationArn)}`,
					{
						method: "GET",
						headers: new Headers(),
					},
				),
			);

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ status: "FAILED" }),
				text: async () => "",
				headers: new Headers(),
			});

			const metadata = createAsyncInvocationMetadata({
				provider: "bedrock",
				id: invocationArn,
				context: {
					invocationArn,
				},
			});

			const result = await provider.getAsyncInvocationStatus(metadata, params);

			expect(result.status).toBe("failed");
			expect(result.result).toBeUndefined();
		});
	});
});
