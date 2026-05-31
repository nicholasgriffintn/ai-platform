import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockRepositories = {
	userSettings: {
		getUserSettings: vi.fn(),
	},
};
const mockHasProviderApiKey = vi.hoisted(() => vi.fn());

vi.mock("~/repositories", () => ({
	RepositoryManager: class {
		constructor() {
			return mockRepositories;
		}
	},
}));

vi.mock("~/repositories/UserSettingsRepository", () => ({
	UserSettingsRepository: class {
		hasProviderApiKey = mockHasProviderApiKey;
	},
}));

const mockWorkersProvider = vi.hoisted(() => ({
	name: "workers",
	transcribe: vi.fn(),
}));

const mockMistralProvider = vi.hoisted(() => ({
	name: "mistral",
	transcribe: vi.fn(),
}));

const mockProviderLibrary = vi.hoisted(() => ({
	transcription: vi.fn((provider: string) => {
		if (provider === "mistral") {
			return mockMistralProvider;
		}
		return mockWorkersProvider;
	}),
}));

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: mockProviderLibrary,
}));

import { handleTranscribe } from "../transcribe";

describe("handleTranscribe", () => {
	const mockEnv: IEnv = { DB: {} } as IEnv;

	const mockUser: IUser = {
		id: "user-123",
		email: "test@example.com",
		plan_id: "pro",
	} as unknown as IUser;

	beforeEach(() => {
		vi.clearAllMocks();
		mockHasProviderApiKey.mockResolvedValue(false);
		mockProviderLibrary.transcription.mockImplementation((provider: string) => {
			if (provider === "mistral") {
				return mockMistralProvider;
			}
			return mockWorkersProvider;
		});
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

		it("allows a signed-in non-Pro user when the selected provider has a key", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
			const freeUser = { ...mockUser, plan_id: "free" } as IUser;
			mockHasProviderApiKey.mockResolvedValue(true);
			mockMistralProvider.transcribe.mockResolvedValue({
				text: "Mistral transcription result",
				data: { duration: 10.5 },
			});

			await handleTranscribe({
				env: mockEnv,
				audio: mockAudio,
				user: freeUser,
				provider: "mistral",
			});

			expect(mockHasProviderApiKey).toHaveBeenCalledWith("user-123", "mistral");
			expect(mockMistralProvider.transcribe).toHaveBeenCalled();
		});

		it("blocks a signed-in non-Pro user from platform transcription providers", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
			const freeUser = { ...mockUser, plan_id: "free" } as IUser;

			await expect(
				handleTranscribe({
					env: mockEnv,
					audio: mockAudio,
					user: freeUser,
					provider: "workers",
				}),
			).rejects.toMatchObject({
				type: ErrorType.AUTHORISATION_ERROR,
			});

			expect(mockWorkersProvider.transcribe).not.toHaveBeenCalled();
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
