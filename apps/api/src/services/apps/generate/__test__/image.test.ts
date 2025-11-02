import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateImage } from "../image";

const mockProvider = {
	getResponse: vi.fn(),
};

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn(() => mockProvider),
	},
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn(),
}));

vi.mock("~/lib/prompts/image", () => ({
	getTextToImageSystemPrompt: vi.fn(),
	imagePrompts: {
		default: "default style",
		cartoon: "cartoon style",
		anime: "anime style",
	},
}));

describe("generateImage", () => {
	const mockEnv = {} as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const { sanitiseInput } = await import("~/lib/chat/utils");
		const { getTextToImageSystemPrompt } = await import("~/lib/prompts/image");
		vi.mocked(sanitiseInput).mockImplementation((input) => input);
		vi.mocked(getTextToImageSystemPrompt).mockReturnValue(
			"Generate a default image:",
		);
	});

	it("should generate image successfully", async () => {
		const mockImageData = { image: "base64imagedata" };
		mockProvider.getResponse.mockResolvedValue(mockImageData);

		const result = await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "A beautiful sunset",
				image_style: "default",
				steps: 4,
			},
			user: mockUser,
		});

		expect(result.status).toBe("success");
		expect(result.name).toBe("create_image");
		expect(result.content).toBe("Image generated successfully");
		expect(result.data).toBe(mockImageData);
		const { getTextToImageSystemPrompt } = await import("~/lib/prompts/image");
		expect(vi.mocked(getTextToImageSystemPrompt)).toHaveBeenCalledWith(
			"default",
		);
		expect(mockProvider.getResponse).toHaveBeenCalledWith({
			completion_id: "completion-123",
			model: "@cf/black-forest-labs/flux-1-schnell",
			app_url: "https://example.com",
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Generate a default image:\n\nA beautiful sunset",
						},
					],
				},
			],
			env: mockEnv,
			user: mockUser,
		});
	});

	it("should return error for missing prompt", async () => {
		const result = await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "",
				image_style: "default",
				steps: 4,
			},
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_image");
		expect(result.content).toBe("Missing prompt");
		expect(result.data).toEqual({});
		expect(mockProvider.getResponse).not.toHaveBeenCalled();
	});

	it("should return error for invalid diffusion steps (too low)", async () => {
		const mockImageData = { image: "base64imagedata" };
		mockProvider.getResponse.mockResolvedValue(mockImageData);

		const result = await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "A beautiful sunset",
				image_style: "default",
				steps: 0, // This will default to 4, so it should succeed
			},
			user: mockUser,
		});

		// Since steps: 0 defaults to 4, this should succeed
		expect(result.status).toBe("success");
		expect(result.name).toBe("create_image");
		expect(result.content).toBe("Image generated successfully");
	});

	it("should return error for invalid diffusion steps (too high)", async () => {
		const result = await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "A beautiful sunset",
				image_style: "default",
				steps: 10,
			},
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_image");
		expect(result.content).toBe("Invalid number of diffusion steps");
		expect(result.data).toEqual({});
		expect(mockProvider.getResponse).not.toHaveBeenCalled();
	});

	it("should return error for invalid diffusion steps (negative)", async () => {
		const result = await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "A beautiful sunset",
				image_style: "default",
				steps: -1,
			},
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_image");
		expect(result.content).toBe("Invalid number of diffusion steps");
		expect(result.data).toEqual({});
		expect(mockProvider.getResponse).not.toHaveBeenCalled();
	});

	it("should use default steps value when steps is 0", async () => {
		const mockImageData = { image: "base64imagedata" };
		mockProvider.getResponse.mockResolvedValue(mockImageData);

		const result = await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "A beautiful sunset",
				image_style: "default",
				steps: 0, // This defaults to 4
			},
			user: mockUser,
		});

		// Should still call the provider since steps defaults to 4
		expect(result.status).toBe("success");
		expect(mockProvider.getResponse).toHaveBeenCalled();
	});

	it("should sanitise input prompt", async () => {
		const mockImageData = { image: "base64imagedata" };
		mockProvider.getResponse.mockResolvedValue(mockImageData);

		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockReturnValue("sanitised prompt");

		await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "unsafe <script>alert('xss')</script> prompt",
				image_style: "default",
				steps: 4,
			},
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
						content: [
							{
								type: "text",
								text: "Generate a default image:\n\nsanitised prompt",
							},
						],
					},
				],
			}),
		);
	});

	it("should handle provider errors", async () => {
		const error = new Error("Provider failed");
		mockProvider.getResponse.mockRejectedValue(error);

		const result = await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "A beautiful sunset",
				image_style: "default",
				steps: 4,
			},
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_image");
		expect(result.content).toBe("Provider failed");
		expect(result.data).toEqual({});
	});

	it("should handle unknown errors", async () => {
		mockProvider.getResponse.mockRejectedValue("Unknown error");

		const result = await generateImage({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "A beautiful sunset",
				image_style: "default",
				steps: 4,
			},
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_image");
		expect(result.content).toBe("Failed to generate image");
		expect(result.data).toEqual({});
	});
});
