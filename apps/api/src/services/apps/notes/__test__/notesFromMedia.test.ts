import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateNotesFromMedia } from "../generate-from-media";

vi.mock("~/services/audio/transcribe", () => ({
	handleTranscribe: vi.fn().mockResolvedValue([{ content: "mock transcript" }]),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn().mockReturnValue({
		getResponse: vi.fn().mockResolvedValue({ response: "mock response" }),
	}),
}));

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: vi
		.fn()
		.mockResolvedValue({ model: "mock-model", provider: "mock-provider" }),
}));

global.fetch = vi.fn();

describe("Transcription Provider Selection Logic", () => {
	const mockEnv = {} as any;
	const mockUser = {} as any;
	const baseParams = {
		env: mockEnv,
		user: mockUser,
		url: "https://example.com/audio.mp3",
		outputs: ["concise_summary" as const],
		noteType: "general",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should select Mistral for small files (≤20MB)", async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValueOnce({
			headers: {
				get: vi.fn().mockReturnValue((10 * 1024 * 1024).toString()), // 10MB
			},
		});

		const { handleTranscribe } = await import("~/services/audio/transcribe");

		await generateNotesFromMedia(baseParams);

		expect(handleTranscribe).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "mistral",
			}),
		);
	});

	it("should select Mistral for exactly 20MB files", async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValueOnce({
			headers: {
				get: vi.fn().mockReturnValue((20 * 1024 * 1024).toString()), // 20MB
			},
		});

		const { handleTranscribe } = await import("~/services/audio/transcribe");

		await generateNotesFromMedia(baseParams);

		expect(handleTranscribe).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "mistral",
			}),
		);
	});

	it("should select Replicate for large files (>20MB)", async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValueOnce({
			headers: {
				get: vi.fn().mockReturnValue((30 * 1024 * 1024).toString()), // 30MB
			},
		});

		const { handleTranscribe } = await import("~/services/audio/transcribe");

		await generateNotesFromMedia(baseParams);

		expect(handleTranscribe).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "replicate",
			}),
		);
	});

	it("should select Replicate for very large files", async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValueOnce({
			headers: {
				get: vi.fn().mockReturnValue((100 * 1024 * 1024).toString()), // 100MB
			},
		});

		const { handleTranscribe } = await import("~/services/audio/transcribe");

		await generateNotesFromMedia(baseParams);

		expect(handleTranscribe).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "replicate",
			}),
		);
	});
});
