import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateVideo } from "../video";

const mockProvider = {
	getResponse: vi.fn(),
};

const mockModelConfig = {
	matchingModel:
		"847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405",
	provider: "replicate",
	name: "Zeroscope V2 XL",
	replicateInputSchema: {
		fields: [
			{ name: "prompt", type: "string", required: true },
			{ name: "negative_prompt", type: "string" },
			{ name: "guidance_scale", type: "number" },
			{ name: "duration", type: "number" },
			{ name: "height", type: "integer" },
			{ name: "width", type: "integer" },
		],
	},
};

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn(() => mockProvider),
	},
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn(),
}));

vi.mock("~/lib/models", () => ({
	getModelConfigByModel: vi.fn(async () => mockModelConfig),
}));

describe("generateVideo", () => {
	const mockEnv = {} as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockImplementation((input) => input);
		const { getModelConfigByModel } = await import("~/lib/models");
		vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig as any);
	});

	it("should generate video successfully", async () => {
		const mockVideoData = {
			status: "in_progress",
			data: {
				asyncInvocation: {
					provider: "replicate",
					id: "prediction-123",
				},
			},
		};
		mockProvider.getResponse.mockResolvedValue(mockVideoData);

		const result = await generateVideo({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "A cat playing with a ball" },
			user: mockUser,
		});

		expect(result.status).toBe("success");
		expect(result.name).toBe("create_video");
		expect(result.content).toBe("Video generation in progress");
		expect(result.data).toBe(mockVideoData);
		expect(mockProvider.getResponse).toHaveBeenCalledWith({
			completion_id: "completion-123",
			app_url: "https://example.com",
			model: "847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405",
			messages: [
				{
					role: "user",
					content: "A cat playing with a ball",
				},
			],
			body: {
				input: {
					prompt: "A cat playing with a ball",
				},
			},
			env: mockEnv,
			user: mockUser,
		});
	});

	it("should include optional parameters when provided", async () => {
		const mockVideoData = { url: "https://example.com/video.mp4" };
		mockProvider.getResponse.mockResolvedValue(mockVideoData);

		await generateVideo({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "A cat playing with a ball",
				negative_prompt: "blurry, low quality",
				guidance_scale: 7.5,
				video_length: 10,
				height: 512,
				width: 512,
			},
			user: mockUser,
		});

		expect(mockProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{
						role: "user",
						content: "A cat playing with a ball",
					},
				],
				body: {
					input: {
						prompt: "A cat playing with a ball",
						negative_prompt: "blurry, low quality",
						guidance_scale: 7.5,
						duration: 10,
						height: 512,
						width: 512,
					},
				},
			}),
		);
	});

	it("should return error for missing prompt", async () => {
		const result = await generateVideo({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_video");
		expect(result.content).toBe("Missing prompt");
		expect(result.data).toEqual({});
		expect(mockProvider.getResponse).not.toHaveBeenCalled();
	});

	it("should sanitise input prompt", async () => {
		const mockVideoData = { url: "https://example.com/video.mp4" };
		mockProvider.getResponse.mockResolvedValue(mockVideoData);

		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockReturnValue("sanitised prompt");

		await generateVideo({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "unsafe <script>alert('xss')</script> prompt" },
			user: mockUser,
		});

		expect(vi.mocked(sanitiseInput)).toHaveBeenCalledWith(
			"unsafe <script>alert('xss')</script> prompt",
		);
		expect(mockProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{
						role: "user",
						content: "sanitised prompt",
					},
				],
				body: {
					input: {
						prompt: "sanitised prompt",
					},
				},
			}),
		);
	});

	it("should handle provider errors", async () => {
		const error = new Error("Provider failed");
		mockProvider.getResponse.mockRejectedValue(error);

		const result = await generateVideo({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "A cat playing with a ball" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_video");
		expect(result.content).toBe("Provider failed");
		expect(result.data).toEqual({});
	});

	it("should handle unknown errors", async () => {
		mockProvider.getResponse.mockRejectedValue("Unknown error");

		const result = await generateVideo({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "A cat playing with a ball" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_video");
		expect(result.content).toBe("Failed to generate video");
		expect(result.data).toEqual({});
	});
});
