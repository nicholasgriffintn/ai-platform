import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type AudioProviderMock = {
	synthesize: ReturnType<typeof vi.fn>;
};

const mockAudioProviders = vi.hoisted<
	Record<"polly" | "cartesia" | "elevenlabs" | "melotts" | "mistral" | "default", AudioProviderMock>
>(() => {
	const createAudioProviderMock = (): AudioProviderMock => ({
		synthesize: vi.fn(),
	});

	return {
		polly: createAudioProviderMock(),
		cartesia: createAudioProviderMock(),
		elevenlabs: createAudioProviderMock(),
		melotts: createAudioProviderMock(),
		mistral: createAudioProviderMock(),
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
const mockGetUserSettings = vi.hoisted(() => vi.fn());

vi.mock("~/lib/storage", () => ({
	StorageService: class {
		constructor() {
			return mockStorageService;
		}
	},
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

vi.mock("~/repositories", () => ({
	RepositoryManager: class {
		userSettings = {
			getUserSettings: mockGetUserSettings,
		};
	},
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
		mockGetUserSettings.mockResolvedValue(null);

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

		it("should truncate input that is too long for the provider", async () => {
			const longInput = "a".repeat(4097);
			mockAudioProviders.melotts.synthesize.mockResolvedValue({
				key: "audio-key",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: longInput,
				user: mockUser,
			});

			expect(mockAudioProviders.melotts.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					input: "a".repeat(4096),
					metadata: {
						inputTruncated: true,
						originalInputLength: 4097,
						truncatedInputLength: 4096,
						maxCharacters: 4096,
						maxWords: undefined,
					},
				}),
			);
			if (Array.isArray(result)) {
				throw new Error("Expected a single speech response");
			}
			expect(result.data.metadata).toMatchObject({
				inputTruncated: true,
				originalInputLength: 4097,
				truncatedInputLength: 4096,
			});
		});

		it("should sanitize input", async () => {
			mockAudioProviders.polly.synthesize.mockResolvedValue({
				key: "audio-key",
			});

			await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
				provider: "polly",
			});

			expect(mockSanitiseInput).toHaveBeenCalledWith("test input");
		});
	});

	describe("provider handling", () => {
		it("should use melotts provider by default", async () => {
			mockAudioProviders.melotts.synthesize.mockResolvedValue({
				key: "melotts-audio-key",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
			});

			expect(mockProviderLibrary.audio).toHaveBeenCalledWith("melotts", {
				env: mockEnv,
				user: mockUser,
			});
			expect(mockAudioProviders.melotts.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					input: "test input",
					slug: "tts/test-40example-com-test-id-123",
					voice: "@cf/myshell-ai/melotts",
				}),
			);
			// @ts-expect-error - mock implementation
			expect(result.data.provider).toBe("melotts");
		});

		it("should use saved speech provider and model by default", async () => {
			mockGetUserSettings.mockResolvedValue({
				speech_provider: "cartesia",
				speech_model: "sonic-3.5",
			});
			mockAudioProviders.cartesia.synthesize.mockResolvedValue({
				key: "cartesia-audio",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
			});

			expect(mockGetUserSettings).toHaveBeenCalledWith("user-123");
			expect(mockProviderLibrary.audio).toHaveBeenCalledWith("cartesia", {
				env: mockEnv,
				user: mockUser,
			});
			expect(mockAudioProviders.cartesia.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					voice: "sonic-3.5",
				}),
			);
			if (Array.isArray(result)) {
				throw new Error("Expected a single speech response");
			}
			expect(result.data.provider).toBe("cartesia");
			expect(result.data.model).toBe("sonic-3.5");
		});

		it("should let request provider and model override saved speech settings", async () => {
			mockGetUserSettings.mockResolvedValue({
				speech_provider: "cartesia",
				speech_model: "sonic-3.5",
			});
			mockAudioProviders.elevenlabs.synthesize.mockResolvedValue({
				key: "elevenlabs-audio",
			});

			await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
				provider: "elevenlabs",
				model: "eleven_multilingual_v2",
			});

			expect(mockGetUserSettings).not.toHaveBeenCalled();
			expect(mockProviderLibrary.audio).toHaveBeenCalledWith("elevenlabs", {
				env: mockEnv,
				user: mockUser,
			});
			expect(mockAudioProviders.elevenlabs.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					voice: "eleven_multilingual_v2",
				}),
			);
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

		it("should pass store=false without storage when storage is disabled", async () => {
			mockAudioProviders.cartesia.synthesize.mockResolvedValue({
				audioDataUrl: "data:audio/mpeg;base64,YXVkaW8=",
				audioBase64: "YXVkaW8=",
				audioMimeType: "audio/mpeg",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
				provider: "cartesia",
				store: false,
			});

			expect(mockAudioProviders.cartesia.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					store: false,
					storage: undefined,
				}),
			);
			if (Array.isArray(result)) {
				throw new Error("Expected a single speech response");
			}
			expect(result.data.audioDataUrl).toBe("data:audio/mpeg;base64,YXVkaW8=");
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

		it("should pass Mistral reference audio and response format", async () => {
			mockAudioProviders.mistral.synthesize.mockResolvedValue({
				audioDataUrl: "data:audio/wav;base64,YXVkaW8=",
				audioBase64: "YXVkaW8=",
				audioMimeType: "audio/wav",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: "test input",
				user: mockUser,
				provider: "mistral",
				model: "e3596645-b1af-469e-b857-f18ddedc7652",
				voice_id: "82c99ee6-f932-423f-a4a3-d403c8914b8d",
				ref_audio: "cmVmLWF1ZGlv",
				response_format: "wav",
				store: false,
			});

			expect(mockProviderLibrary.audio).toHaveBeenCalledWith("mistral", {
				env: mockEnv,
				user: mockUser,
			});
			expect(mockAudioProviders.mistral.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					voice: "82c99ee6-f932-423f-a4a3-d403c8914b8d",
					refAudio: "cmVmLWF1ZGlv",
					responseFormat: "wav",
					store: false,
				}),
			);
			if (Array.isArray(result)) {
				throw new Error("Expected a single speech response");
			}
			expect(result.data.provider).toBe("mistral");
			expect(result.data.audioMimeType).toBe("audio/wav");
		});

		it("should truncate Mistral input to its provider word limit", async () => {
			const words = Array.from({ length: 301 }, (_, index) => `word-${index + 1}`);
			mockAudioProviders.mistral.synthesize.mockResolvedValue({
				audioBase64: "YXVkaW8=",
			});

			const result = await handleTextToSpeech({
				env: mockEnv,
				input: words.join(" "),
				user: mockUser,
				provider: "mistral",
				store: false,
			});

			const expectedInput = words.slice(0, 300).join(" ");
			expect(mockAudioProviders.mistral.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expectedInput,
					metadata: {
						inputTruncated: true,
						originalInputLength: words.join(" ").length,
						truncatedInputLength: expectedInput.length,
						maxCharacters: 4096,
						maxWords: 300,
					},
				}),
			);
			if (Array.isArray(result)) {
				throw new Error("Expected a single speech response");
			}
			expect(result.data.metadata).toMatchObject({
				inputTruncated: true,
				maxWords: 300,
			});
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
				provider: "polly",
			});

			expect(result).toMatchObject({
				status: "success",
				content: "audio-key-123",
				data: {
					provider: "polly",
					model: "Ruth",
					audioKey: "audio-key-123",
					audioUrl: "https://assets.test.com/audio-key-123",
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

			expect(result).toMatchObject({
				status: "success",
				content:
					"Audio generated successfully\n[Listen to the audio](https://example.com/audio.mp3)",
				data: {
					provider: "cartesia",
					model: "sonic-3.5",
					audioUrl: "https://example.com/audio.mp3",
					response: "Audio generated successfully",
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
				provider: "polly",
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
				provider: "polly",
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
				provider: "polly",
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
				provider: "polly",
			});

			expect(mockAudioProviders.polly.synthesize).toHaveBeenCalledWith(
				expect.objectContaining({
					slug: "tts/test-2Buser-40example-site-com-test-id-123",
				}),
			);
		});
	});
});
