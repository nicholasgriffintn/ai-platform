import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IFunctionResponse } from "~/types";
import { AssistantError } from "~/utils/errors";
import { handlePodcastSummarise } from "../summarise";

const mockRepositories = {
	appData: {
		getAppDataByUserAppAndItem: vi.fn(),
		createAppDataWithItem: vi.fn(),
	},
};

const mockAI = {
	run: vi.fn(),
};

vi.mock("~/repositories", () => ({
	RepositoryManager: {
		getInstance: vi.fn(() => mockRepositories),
	},
}));

describe("handlePodcastSummarise", () => {
	const mockEnv = {
		DB: {},
		AI: mockAI,
	} as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;
	const mockContext = {
		env: mockEnv,
		user: mockUser,
		repositories: mockRepositories,
		ensureDatabase: vi.fn(),
		requireUser: vi.fn(() => mockUser),
		database: {} as any,
		requestId: undefined,
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return existing summary when already processed", async () => {
		const existingSummary = {
			data: JSON.stringify({
				summary: "Existing summary",
				speakers: { A: "Speaker 1", B: "Speaker 2" },
			}),
		};

		mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue([
			existingSummary,
		]);

		const result = (await handlePodcastSummarise({
			context: mockContext,
			request: {
				podcastId: "podcast-123",
				speakers: { A: "Speaker 1", B: "Speaker 2" },
			},
			user: mockUser,
		})) as IFunctionResponse;

		expect(result.status).toBe("success");
		expect(result.content).toBe("Existing summary");
		expect(result.data).toEqual({
			summary: "Existing summary",
			speakers: { A: "Speaker 1", B: "Speaker 2" },
		});
		expect(mockAI.run).not.toHaveBeenCalled();
	});

	it("should generate new summary from transcription", async () => {
		const transcriptionData = {
			data: JSON.stringify({
				title: "Test Podcast",
				description: "Test Description",
				transcriptionData: {
					output: {
						segments: [
							{ speaker: "A", text: "Hello everyone" },
							{ speaker: "B", text: "Welcome to the show" },
						],
					},
				},
			}),
		};

		mockRepositories.appData.getAppDataByUserAppAndItem
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([transcriptionData]);

		mockAI.run.mockResolvedValue({
			summary: "This podcast features a conversation between two speakers.",
		});

		const result = (await handlePodcastSummarise({
			context: mockContext,
			request: {
				podcastId: "podcast-123",
				speakers: { A: "Speaker 1", B: "Speaker 2" },
			},
			user: mockUser,
		})) as IFunctionResponse;

		expect(result.status).toBe("success");
		expect(result.content).toBe(
			"This podcast features a conversation between two speakers.",
		);
		expect(mockAI.run).toHaveBeenCalledWith(
			"@cf/facebook/bart-large-cnn",
			{
				input_text: "Speaker 1: Hello everyone\nSpeaker 2: Welcome to the show",
				max_length: 52,
			},
			expect.objectContaining({
				gateway: expect.objectContaining({
					metadata: { email: "test@example.com" },
				}),
			}),
		);
	});

	it("should throw error for missing podcast ID", async () => {
		await expect(
			handlePodcastSummarise({
				env: mockEnv,
				request: {
					podcastId: "",
					speakers: { A: "Speaker 1" },
				},
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));
	});

	it("should throw error for missing user ID", async () => {
		await expect(
			handlePodcastSummarise({
				env: mockEnv,
				request: {
					podcastId: "podcast-123",
					speakers: { A: "Speaker 1" },
				},
				user: {} as any,
			}),
		).rejects.toThrow(expect.any(AssistantError));
	});
});
