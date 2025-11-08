import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSpeech } from "../speech";

const mockProvider = {
	getResponse: vi.fn(),
};

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(() => mockProvider),
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn(),
}));

describe("generateSpeech", () => {
	const mockEnv = { DB: {} } as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockImplementation((input) => input);
	});

	it("should generate speech successfully", async () => {
		const mockSpeechData = { audio: "base64audiodata" };
		mockProvider.getResponse.mockResolvedValue(mockSpeechData);

		const result = await generateSpeech({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "Hello world" },
			user: mockUser,
		});

		expect(result.status).toBe("success");
		expect(result.name).toBe("create_speech");
		expect(result.content).toBe("Speech generated successfully");
		expect(result.data).toBe(mockSpeechData);
		expect(mockProvider.getResponse).toHaveBeenCalledWith({
			completion_id: "completion-123",
			model: "@cf/myshell-ai/melotts",
			app_url: "https://example.com",
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello world",
						},
					],
				},
			],
			lang: "en",
			env: mockEnv,
			user: mockUser,
		});
	});

	it("should use custom language when provided", async () => {
		const mockSpeechData = { audio: "base64audiodata" };
		mockProvider.getResponse.mockResolvedValue(mockSpeechData);

		await generateSpeech({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "Hello world", lang: "es" },
			user: mockUser,
		});

		expect(mockProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				lang: "es",
			}),
		);
	});

	it("should return error for missing prompt", async () => {
		const result = await generateSpeech({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_speech");
		expect(result.content).toBe("Missing prompt");
		expect(result.data).toEqual({});
		expect(mockProvider.getResponse).not.toHaveBeenCalled();
	});

	it("should sanitise input prompt", async () => {
		const mockSpeechData = { audio: "base64audiodata" };
		mockProvider.getResponse.mockResolvedValue(mockSpeechData);

		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockReturnValue("sanitised prompt");

		await generateSpeech({
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
						content: [
							{
								type: "text",
								text: "sanitised prompt",
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

		const result = await generateSpeech({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "Hello world" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_speech");
		expect(result.content).toBe("Provider failed");
		expect(result.data).toEqual({});
	});

	it("should handle unknown errors", async () => {
		mockProvider.getResponse.mockRejectedValue("Unknown error");

		const result = await generateSpeech({
			completion_id: "completion-123",
			app_url: "https://example.com",
			env: mockEnv,
			args: { prompt: "Hello world" },
			user: mockUser,
		});

		expect(result.status).toBe("error");
		expect(result.name).toBe("create_speech");
		expect(result.content).toBe("Failed to generate speech");
		expect(result.data).toEqual({});
	});
});
