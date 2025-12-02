import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";
import { handlePodcastDetail } from "../get-details";

const mockRepositories = {
	appData: {
		getAppDataByUserAppAndItem: vi.fn(),
	},
};

describe("handlePodcastDetail", () => {
	const mockEnv = { DB: {} } as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;
	const createMockContext = (overrides: Partial<ServiceContext> = {}) =>
		({
			env: mockEnv,
			user: mockUser,
			repositories: mockRepositories as any,
			ensureDatabase: vi.fn(),
			requireUser: vi.fn(() => mockUser),
			database: {} as any,
			requestId: undefined,
			requestCache: new Map(),
			...overrides,
		}) satisfies ServiceContext;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return complete podcast details", async () => {
		const mockAppData = [
			{
				item_type: "upload",
				data: JSON.stringify({
					title: "Test Podcast",
					description: "Test Description",
					audioUrl: "https://example.com/audio.mp3",
					duration: 300,
					createdAt: "2023-01-01T00:00:00Z",
				}),
			},
			{
				item_type: "transcribe",
				data: JSON.stringify({
					transcriptionData: {
						output: { segments: [{ speaker: "A", text: "Hello world" }] },
					},
				}),
			},
			{
				item_type: "summary",
				data: JSON.stringify({
					summary: "This is a test summary",
				}),
			},
			{
				item_type: "image",
				data: JSON.stringify({
					imageUrl: "https://example.com/image.png",
				}),
			},
		];

		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAppData,
		);

		const result = await handlePodcastDetail({
			context: createMockContext(),
			podcastId: "podcast-123",
			user: mockUser,
		});

		expect(result).toEqual({
			id: "podcast-123",
			title: "Test Podcast",
			description: "Test Description",
			createdAt: "2023-01-01T00:00:00Z",
			imageUrl: "https://example.com/image.png",
			audioUrl: "https://example.com/audio.mp3",
			duration: 300,
			transcript: { segments: [{ speaker: "A", text: "Hello world" }] },
			summary: "This is a test summary",
			status: "complete",
		});
	});

	it("should return processing status for podcast with only upload", async () => {
		const mockAppData = [
			{
				item_type: "upload",
				data: JSON.stringify({
					title: "Test Podcast",
					audioUrl: "https://example.com/audio.mp3",
					createdAt: "2023-01-01T00:00:00Z",
				}),
			},
		];

		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAppData,
		);

		const result = await handlePodcastDetail({
			context: createMockContext(),
			podcastId: "podcast-123",
			user: mockUser,
		});

		expect(result.status).toBe("processing");
		expect(result.transcript).toBeUndefined();
		expect(result.summary).toBeUndefined();
		expect(result.imageUrl).toBeUndefined();
	});

	it("should return transcribing status for podcast with transcription", async () => {
		const mockAppData = [
			{
				item_type: "upload",
				data: JSON.stringify({
					title: "Test Podcast",
					audioUrl: "https://example.com/audio.mp3",
					createdAt: "2023-01-01T00:00:00Z",
				}),
			},
			{
				item_type: "transcribe",
				data: JSON.stringify({
					transcriptionData: { output: "transcription" },
				}),
			},
		];

		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAppData,
		);

		const result = await handlePodcastDetail({
			context: createMockContext(),
			podcastId: "podcast-123",
			user: mockUser,
		});

		expect(result.status).toBe("transcribing");
		expect(result.transcript).toBe("transcription");
	});

	it("should return summarizing status for podcast with summary", async () => {
		const mockAppData = [
			{
				item_type: "upload",
				data: JSON.stringify({
					title: "Test Podcast",
					audioUrl: "https://example.com/audio.mp3",
					createdAt: "2023-01-01T00:00:00Z",
				}),
			},
			{
				item_type: "transcribe",
				data: JSON.stringify({
					transcriptionData: { output: "transcription" },
				}),
			},
			{
				item_type: "summary",
				data: JSON.stringify({
					summary: "Test summary",
				}),
			},
		];

		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAppData,
		);

		const result = await handlePodcastDetail({
			context: createMockContext(),
			podcastId: "podcast-123",
			user: mockUser,
		});

		expect(result.status).toBe("summarizing");
		expect(result.summary).toBe("Test summary");
	});

	it("should use default title for untitled podcast", async () => {
		const mockAppData = [
			{
				item_type: "upload",
				data: JSON.stringify({
					audioUrl: "https://example.com/audio.mp3",
					createdAt: "2023-01-01T00:00:00Z",
				}),
			},
		];

		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAppData,
		);

		const result = await handlePodcastDetail({
			context: createMockContext(),
			podcastId: "podcast-123",
			user: mockUser,
		});

		expect(result.title).toBe("Untitled Podcast");
	});

	it("should handle malformed JSON data gracefully", async () => {
		const mockAppData = [
			{
				item_type: "upload",
				data: "invalid-json",
			},
		];

		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAppData,
		);

		const result = await handlePodcastDetail({
			context: createMockContext(),
			podcastId: "podcast-123",
			user: mockUser,
		});

		expect(result.title).toBe("Untitled Podcast");
		expect(result.status).toBe("processing");
	});

	it("should throw error for missing user ID", async () => {
		await expect(
			handlePodcastDetail({
				context: createMockContext(),
				podcastId: "podcast-123",
				user: {} as any,
			}),
		).rejects.toThrow(expect.any(AssistantError));
	});

	it("should throw error for podcast not found", async () => {
		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue([]);

		await expect(
			handlePodcastDetail({
				context: createMockContext(),
				podcastId: "non-existent",
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));
	});

	it("should skip items without item_type", async () => {
		const mockAppData = [
			{
				data: JSON.stringify({
					title: "Test Podcast",
					audioUrl: "https://example.com/audio.mp3",
					createdAt: "2023-01-01T00:00:00Z",
				}),
			},
		];

		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAppData,
		);

		const result = await handlePodcastDetail({
			context: createMockContext(),
			podcastId: "podcast-123",
			user: mockUser,
		});

		expect(result.title).toBe("Untitled Podcast");
		expect(result.status).toBe("processing");
	});
});
