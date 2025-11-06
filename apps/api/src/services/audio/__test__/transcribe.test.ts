import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockRepositories = {
	userSettings: {
		getUserSettings: vi.fn(),
	},
};

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn(() => mockRepositories),
}));

const mockWorkersProvider = vi.hoisted(() => ({
	name: "workers",
	transcribe: vi.fn(),
}));

const mockMistralProvider = vi.hoisted(() => ({
	name: "mistral",
	transcribe: vi.fn(),
}));

vi.mock("~/lib/transcription/factory", () => ({
	TranscriptionProviderFactory: {
		getProvider: vi.fn((provider: string) => {
			if (provider === "mistral") return mockMistralProvider;
			return mockWorkersProvider;
		}),
	},
}));

import { handleTranscribe } from "../transcribe";

describe("handleTranscribe", () => {
	const mockEnv: IEnv = { DB: {} } as IEnv;

	const mockUser: IUser = {
		id: "user-123",
		email: "test@example.com",
	} as unknown as IUser;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("parameter validation", () => {
		it("should throw error when audio is missing", async () => {
			await expect(
				handleTranscribe({
					env: mockEnv,
					audio: null as any,
					user: mockUser,
				}),
			).rejects.toMatchObject({
				message: "Missing audio",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("provider selection", () => {
		it("should use workers provider by default", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
			const mockResponse = {
				text: "This is the transcribed text",
				data: { other_data: "metadata" },
			};

			mockWorkersProvider.transcribe.mockResolvedValue(mockResponse);

			const result = await handleTranscribe({
				env: mockEnv,
				audio: mockAudio,
				user: mockUser,
			});

			expect(mockWorkersProvider.transcribe).toHaveBeenCalledWith({
				env: mockEnv,
				audio: mockAudio,
				user: mockUser,
				provider: "workers",
				timestamps: false,
			});

			expect(result).toEqual({
				status: "success",
				content: "This is the transcribed text",
				data: { other_data: "metadata" },
			});
		});

		it("should use mistral provider when specified", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
			const mockResponse = {
				text: "Mistral transcription result",
				data: { duration: 10.5 },
			};

			mockMistralProvider.transcribe.mockResolvedValue(mockResponse);

			const result = await handleTranscribe({
				env: mockEnv,
				audio: mockAudio,
				user: mockUser,
				provider: "mistral",
			});

			expect(mockMistralProvider.transcribe).toHaveBeenCalledWith({
				env: mockEnv,
				audio: mockAudio,
				user: mockUser,
				provider: "mistral",
				timestamps: false,
			});

			expect(result).toEqual({
				status: "success",
				content: "Mistral transcription result",
				data: { duration: 10.5 },
			});
		});
	});

	describe("error handling", () => {
		it("should handle provider errors", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
			const providerError = new AssistantError(
				"Provider specific error",
				ErrorType.EXTERNAL_API_ERROR,
			);

			mockWorkersProvider.transcribe.mockRejectedValue(providerError);

			await expect(
				handleTranscribe({
					env: mockEnv,
					audio: mockAudio,
					user: mockUser,
				}),
			).rejects.toThrow(providerError);
		});

		it("should wrap unknown errors", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
			const unknownError = new Error("Unknown error");

			mockWorkersProvider.transcribe.mockRejectedValue(unknownError);

			await expect(
				handleTranscribe({
					env: mockEnv,
					audio: mockAudio,
					user: mockUser,
				}),
			).rejects.toMatchObject({
				message: "Transcription failed: Unknown error",
				type: ErrorType.EXTERNAL_API_ERROR,
				name: "AssistantError",
			});
		});
	});
});
