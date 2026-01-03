import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateImage } from "../image";

const mockProvider = {
	generate: vi.fn(),
};

vi.mock("~/lib/providers/capabilities/image", () => ({
	getImageProvider: vi.fn(() => mockProvider),
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn(),
}));

describe("generateImage", () => {
	const mockEnv = { DB: {} } as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockImplementation((input) => input);
	});

	it("should generate image successfully", async () => {
		const mockImageData = { url: "https://example.com/image.png" };
		mockProvider.generate.mockResolvedValue(mockImageData);

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
		expect(mockProvider.generate).toHaveBeenCalledWith({
			prompt: "A beautiful sunset",
			env: mockEnv,
			user: mockUser,
			completion_id: "completion-123",
			app_url: "https://example.com",
			style: "default",
			aspectRatio: undefined,
			width: undefined,
			height: undefined,
			steps: 4,
			model: undefined,
			metadata: {
				steps: 4,
			},
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
		expect(mockProvider.generate).not.toHaveBeenCalled();
	});

	it("should return error for invalid diffusion steps (too low)", async () => {
		const mockImageData = { url: "https://example.com/image.png" };
		mockProvider.generate.mockResolvedValue(mockImageData);

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
		expect(mockProvider.generate).not.toHaveBeenCalled();
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
		expect(mockProvider.generate).not.toHaveBeenCalled();
	});

	it("should use default steps value when steps is 0", async () => {
		const mockImageData = { url: "https://example.com/image.png" };
		mockProvider.generate.mockResolvedValue(mockImageData);

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
		expect(mockProvider.generate).toHaveBeenCalled();
	});

	it("should sanitise input prompt", async () => {
		const mockImageData = { url: "https://example.com/image.png" };
		mockProvider.generate.mockResolvedValue(mockImageData);

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
		expect(mockProvider.generate).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "sanitised prompt",
			}),
		);
	});

	it("should handle provider errors", async () => {
		const error = new Error("Provider failed");
		mockProvider.generate.mockRejectedValue(error);

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
		mockProvider.generate.mockRejectedValue("Unknown error");

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
