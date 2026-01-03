import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateVideo } from "../video";

const mockProvider = {
	generate: vi.fn(),
};

vi.mock("~/lib/providers/capabilities/video", () => ({
	getVideoProvider: vi.fn(() => mockProvider),
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn(),
}));

describe("generateVideo", () => {
	const mockEnv = { DB: {} } as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockImplementation((input) => input);
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
		mockProvider.generate.mockResolvedValue(mockVideoData);

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
		expect(mockProvider.generate).toHaveBeenCalledWith({
			prompt: "A cat playing with a ball",
			env: mockEnv,
			user: mockUser,
			completion_id: "completion-123",
			app_url: "https://example.com",
			negativePrompt: undefined,
			guidanceScale: undefined,
			videoLength: undefined,
			duration: undefined,
			height: undefined,
			width: undefined,
			aspectRatio: undefined,
			model: undefined,
		});
	});

	it("should include optional parameters when provided", async () => {
		const mockVideoData = { url: "https://example.com/video.mp4" };
		mockProvider.generate.mockResolvedValue(mockVideoData);

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

		expect(mockProvider.generate).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "A cat playing with a ball",
				negativePrompt: "blurry, low quality",
				guidanceScale: 7.5,
				videoLength: 10,
				height: 512,
				width: 512,
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
		expect(mockProvider.generate).not.toHaveBeenCalled();
	});

	it("should sanitise input prompt", async () => {
		const mockVideoData = { url: "https://example.com/video.mp4" };
		mockProvider.generate.mockResolvedValue(mockVideoData);

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
		expect(mockProvider.generate).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "sanitised prompt",
			}),
		);
	});

	it("should handle provider errors", async () => {
		const error = new Error("Provider failed");
		mockProvider.generate.mockRejectedValue(error);

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
		mockProvider.generate.mockRejectedValue("Unknown error");

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
