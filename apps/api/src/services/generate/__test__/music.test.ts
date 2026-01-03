import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateMusic } from "../music";

const mockProvider = {
	generate: vi.fn(),
};

vi.mock("~/lib/providers/capabilities/music", () => ({
	getMusicProvider: vi.fn(() => mockProvider),
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn(),
}));

describe("generateMusic", () => {
	const mockEnv = { DB: {} } as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockImplementation((input) => input);
	});

	it("should generate music successfully", async () => {
		const mockMusicData = { audio: "https://example.com/music.mp3" };
		mockProvider.generate.mockResolvedValue(mockMusicData);

		const result = await generateMusic({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "Upbeat electronic music" },
			user: mockUser,
		});

		expect(result.status).toBe("success");
		expect(result.name).toBe("create_music");
		expect(result.content).toBe("Music generated successfully");
		expect(result.data).toBe(mockMusicData);
		expect(mockProvider.generate).toHaveBeenCalledWith({
			prompt: "Upbeat electronic music",
			env: mockEnv,
			user: mockUser,
			completion_id: "completion-123",
			app_url: "https://example.com",
			inputAudio: undefined,
			duration: undefined,
			model: undefined,
		});
	});

	it("should include optional parameters when provided", async () => {
		const mockMusicData = { audio: "https://example.com/music.mp3" };
		mockProvider.generate.mockResolvedValue(mockMusicData);

		await generateMusic({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: {
				prompt: "Upbeat electronic music",
				input_audio: "base64audiodata",
				duration: 30,
			},
			user: mockUser,
		});

		expect(mockProvider.generate).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "Upbeat electronic music",
				inputAudio: "base64audiodata",
				duration: 30,
			}),
		);
	});

	it("should return error for missing prompt", async () => {
		const result = await generateMusic({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_music");
		expect(result.content).toBe("Missing prompt");
		expect(result.data).toEqual({});
		expect(mockProvider.generate).not.toHaveBeenCalled();
	});

	it("should sanitise input prompt", async () => {
		const mockMusicData = { audio: "https://example.com/music.mp3" };
		mockProvider.generate.mockResolvedValue(mockMusicData);

		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockReturnValue("sanitised prompt");

		await generateMusic({
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

		const result = await generateMusic({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "Upbeat electronic music" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_music");
		expect(result.content).toBe("Provider failed");
		expect(result.data).toEqual({});
	});

	it("should handle unknown errors", async () => {
		mockProvider.generate.mockRejectedValue("Unknown error");

		const result = await generateMusic({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "Upbeat electronic music" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_music");
		expect(result.content).toBe("Failed to generate music");
		expect(result.data).toEqual({});
	});
});
