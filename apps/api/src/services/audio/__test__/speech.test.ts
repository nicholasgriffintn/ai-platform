import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type AudioProviderMock = {
	synthesize: ReturnType<typeof vi.fn>;
};

const mockAudioProviders = vi.hoisted<
	Record<
		"polly" | "cartesia" | "elevenlabs" | "melotts" | "default",
		AudioProviderMock
	>
>(() => {
	const createAudioProviderMock = (): AudioProviderMock => ({
		synthesize: vi.fn(),
	});

	return {
		polly: createAudioProviderMock(),
		cartesia: createAudioProviderMock(),
		elevenlabs: createAudioProviderMock(),
		melotts: createAudioProviderMock(),
		default: createAudioProviderMock(),
	};
});

const mockProviderLibrary = vi.hoisted(() => ({
	audio: vi.fn((provider: string) => {
		const key = provider as keyof typeof mockAudioProviders;
		return mockAudioProviders[key] ?? mockAudioProviders.default;
	}),
}));

const mockStorageService = vi.hoisted(() => ({
	uploadObject: vi.fn(),
}));

const mockGenerateId = vi.hoisted(() => vi.fn(() => "test-id-123"));

const mockSanitiseInput = vi.hoisted(() => vi.fn((input: string) => input));

vi.mock("~/lib/storage", () => ({
	StorageService: vi.fn(() => mockStorageService),
}));

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: mockProviderLibrary,
}));

vi.mock("~/utils/id", () => ({
	generateId: mockGenerateId,
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: mockSanitiseInput,
}));

import { handleTextToSpeech } from "../speech";

describe("handleTextToSpeech", () => {
	const mockEnv: IEnv = {
		ASSETS_BUCKET: {} as any,
		PUBLIC_ASSETS_URL: "https://assets.test.com",
	} as any;

	const mockUser: IUser = {
		id: "user-123",
		email: "test@example.com",
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockSanitiseInput.mockImplementation((input) => input);
		mockGenerateId.mockReturnValue("test-id-123");
		mockProviderLibrary.audio.mockImplementation((provider: string) => {
			const key = provider as keyof typeof mockAudioProviders;
			return mockAudioProviders[key] ?? mockAudioProviders.default;
		});

		for (const provider of Object.values(mockAudioProviders)) {
			provider.synthesize.mockReset();
		}
	});

	describe("parameter validation", () => {
		it("should throw error for missing input", async () => {
			mockSanitiseInput.mockReturnValue("");

			await expect(
				handleTextToSpeech({
					env: mockEnv,
					input: "",
					user: mockUser,
				}),
			).rejects.toMatchObject({
				message: "Missing input",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});

			expect(mockProviderLibrary.audio).not.toHaveBeenCalled();
		});

		it("should throw error for input too long", async () => {
			const longInput = "a".repeat(4097);

			await expect(
				handleTextToSpeech({
					env: mockEnv,
					input: longInput,
					user: mockUser,
				}),
			).rejects.toMatchObject({
				message: "Input is too long",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});

			expect(mockProviderLibrary.audio).not.toHaveBeenCalled();
		});

		it("should sanitize input", async () => {
			mockAudioProviders.polly.synthesize.mockResolvedValue({
				key: "audio-key",
			});

			await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
			});

			expect(mockSanitiseInput).toHaveBeenCalledWith("test input");
		});
	});

	describe("provider handling", () => {
		it("should use polly provider by default", async () => {
			mockAudioProviders.polly.synthesize.mockResolvedValue({
				key: "polly-audio-key",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
			});

			expect(mockProviderLibrary.audio).toHaveBeenCalledWith("polly", {
				env: mockEnv,
				user: mockUser,
			});
			expect(mockAudioProviders.polly.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					input: "test input",
					slug: "tts/test-40example-com-test-id-123",
				}),
			);
			// @ts-expect-error - mock implementation
			expect(result.data.provider).toBe("polly");
		});

		it("should use specified provider", async () => {
			mockAudioProviders.cartesia.synthesize.mockResolvedValue({
				key: "cartesia-audio",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
				provider: "cartesia",
			});

			expect(mockProviderLibrary.audio).toHaveBeenCalledWith("cartesia", {
				env: mockEnv,
				user: mockUser,
			});
			expect(mockAudioProviders.cartesia.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					storage: mockStorageService,
					slug: "tts/test-40example-com-test-id-123",
				}),
			);
			// @ts-expect-error - mock implementation
			expect(result.data.provider).toBe("cartesia");
		});

		it("should pass locale to melotts provider", async () => {
			mockAudioProviders.melotts.synthesize.mockResolvedValue({
				response: "melotts-response",
			});

			await handleTextToSpeech({
				env: mockEnv,
				input: "hola",
				user: mockUser,
				provider: "melotts",
				lang: "es",
			});

			expect(mockAudioProviders.melotts.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					locale: "es",
				}),
			);
		});

		it("should default melotts locale to en", async () => {
			mockAudioProviders.melotts.synthesize.mockResolvedValue({
				response: "melotts-response",
			});

			await handleTextToSpeech({
				env: mockEnv,
				input: "hello",
				user: mockUser,
				provider: "melotts",
			});

			expect(mockAudioProviders.melotts.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					locale: "en",
				}),
			);
		});
	});

	describe("response handling", () => {
		it("should handle key-based responses", async () => {
			mockAudioProviders.polly.synthesize.mockResolvedValue({
				key: "audio-key-123",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
			});

			expect(result).toEqual({
				status: "success",
				content: "audio-key-123",
				data: {
					provider: "polly",
					audioKey: "audio-key-123",
					audioUrl: "https://assets.test.com/audio-key-123",
					response: undefined,
					metadata: undefined,
				},
			});
		});

		it("should handle response text with URL", async () => {
			mockAudioProviders.cartesia.synthesize.mockResolvedValue({
				response: "Audio generated successfully",
				url: "https://example.com/audio.mp3",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
				provider: "cartesia",
			});

			expect(result).toEqual({
				status: "success",
				content:
					"Audio generated successfully\n[Listen to the audio](https://example.com/audio.mp3)",
				data: {
					provider: "cartesia",
					audioKey: undefined,
					audioUrl: "https://example.com/audio.mp3",
					response: "Audio generated successfully",
					metadata: undefined,
				},
			});
		});

		it("should handle missing PUBLIC_ASSETS_URL", async () => {
			const envWithoutUrl = { ...mockEnv, PUBLIC_ASSETS_URL: "" };
			mockAudioProviders.polly.synthesize.mockResolvedValue({
				key: "audio-key-123",
			});

			const result = await handleTextToSpeech({
				env: envWithoutUrl,
				input: "test input",
				user: mockUser,
			});

			// @ts-expect-error - mock implementation
			expect(result.data.audioUrl).toBe("/audio-key-123");
		});

		it("should throw error when provider returns no response", async () => {
			mockAudioProviders.polly.synthesize.mockResolvedValue(null as any);

			await expect(
				handleTextToSpeech({
					env: mockEnv,
					input: "test input",
					user: mockUser,
				}),
			).rejects.toBeInstanceOf(AssistantError);
		});
	});

	describe("user email slug generation", () => {
		it("should generate slug with user email", async () => {
			mockAudioProviders.polly.synthesize.mockResolvedValue({
				key: "audio-key",
			});

			await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
			});

			expect(mockAudioProviders.polly.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					slug: "tts/test-40example-com-test-id-123",
				}),
			);
		});

		it("should handle user without email", async () => {
			const userWithoutEmail = { ...mockUser, email: undefined };
			mockAudioProviders.polly.synthesize.mockResolvedValue({
				key: "audio-key",
			});

			await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: userWithoutEmail,
			});

			expect(mockAudioProviders.polly.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					slug: "tts/unknown-test-id-123",
				}),
			);
		});

		it("should handle special characters in email", async () => {
			const userWithSpecialEmail = {
				...mockUser,
				email: "test+user@example-site.com",
			};
			mockAudioProviders.polly.synthesize.mockResolvedValue({
				key: "audio-key",
			});

			await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: userWithSpecialEmail,
			});

			expect(mockAudioProviders.polly.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					slug: "tts/test-2Buser-40example-site-com-test-id-123",
				}),
			);
		});
	});
});
