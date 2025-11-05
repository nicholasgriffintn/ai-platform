import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { WorkersTranscriptionProvider } from "../workers";
import { Database } from "~/lib/database";

const mockAI = vi.hoisted(() => ({
	run: vi.fn(),
}));

const mockGatewayId = vi.hoisted(() => "test-gateway-id");

vi.mock("~/constants/app", () => ({
	gatewayId: mockGatewayId,
}));

,
	},
}));

describe("WorkersTranscriptionProvider", () => {
	const provider = new WorkersTranscriptionProvider();

	const mockEnv: IEnv = { DB: {} as any,
		AI: mockAI,
	} as any;

	const mockUser: IUser = {
		id: "user-123",
		email: "test@example.com",
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("transcribe", () => {
		it("should transcribe audio successfully", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
			const mockResponse = {
				text: "This is the transcribed text from Workers AI",
				other_data: "additional metadata",
			};

			mockAI.run.mockResolvedValue(mockResponse);

			const result = await provider.transcribe({
				env: mockEnv,
				audio: mockAudio,
				user: mockUser,
			});

			expect(mockAI.run).toHaveBeenCalledWith(
				"@cf/openai/whisper",
				{
					audio: expect.any(Array),
				},
				{
					gateway: {
						id: "test-gateway-id",
						skipCache: false,
						cacheTtl: 3360,
						metadata: {
							email: "test@example.com",
						},
					},
				},
			);

			expect(result).toEqual({
				text: "This is the transcribed text from Workers AI",
				data: mockResponse,
			});
		});

		it("should handle user without email", async () => {
			const userWithoutEmail = { ...mockUser, email: undefined };
			const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
			const mockResponse = { text: "transcribed text" };

			mockAI.run.mockResolvedValue(mockResponse);

			await provider.transcribe({
				env: mockEnv,
				audio: mockAudio,
				user: userWithoutEmail,
			});

			expect(mockAI.run).toHaveBeenCalledWith(
				"@cf/openai/whisper",
				expect.any(Object),
				{
					gateway: {
						id: "test-gateway-id",
						skipCache: false,
						cacheTtl: 3360,
						metadata: {
							email: undefined,
						},
					},
				},
			);
		});

		it("should convert audio blob to correct format", async () => {
			const audioData = new Uint8Array([1, 2, 3, 4, 5]);
			const mockAudio = new Blob([audioData], { type: "audio/wav" });
			const mockResponse = { text: "test transcription" };

			mockAI.run.mockResolvedValue(mockResponse);

			await provider.transcribe({
				env: mockEnv,
				audio: mockAudio,
				user: mockUser,
			});

			expect(mockAI.run).toHaveBeenCalledWith(
				"@cf/openai/whisper",
				{
					audio: [1, 2, 3, 4, 5],
				},
				expect.any(Object),
			);
		});

		it("should throw error when AI binding is missing", async () => {
			const envWithoutAI = { ...mockEnv, AI: undefined };
			const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

			await expect(
				provider.transcribe({
					env: envWithoutAI,
					audio: mockAudio,
					user: mockUser,
				}),
			).rejects.toMatchObject({
				message: "Missing AI binding",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});
		});

		it("should throw error when audio is missing", async () => {
			await expect(
				provider.transcribe({
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

		it("should throw error when user is missing", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

			await expect(
				provider.transcribe({
					env: mockEnv,
					audio: mockAudio,
					user: null as any,
				}),
			).rejects.toMatchObject({
				message: "Missing user",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});
		});

		it("should throw error when model returns no text", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
			const mockResponse = { other_data: "metadata" };

			mockAI.run.mockResolvedValue(mockResponse);

			await expect(
				provider.transcribe({
					env: mockEnv,
					audio: mockAudio,
					user: mockUser,
				}),
			).rejects.toMatchObject({
				message: "No response from the model",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});

		it("should throw error when model returns empty text", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
			const mockResponse = { text: "" };

			mockAI.run.mockResolvedValue(mockResponse);

			await expect(
				provider.transcribe({
					env: mockEnv,
					audio: mockAudio,
					user: mockUser,
				}),
			).rejects.toMatchObject({
				message: "No response from the model",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});

		it("should handle AI.run errors", async () => {
			const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

			mockAI.run.mockRejectedValue(new Error("AI service error"));

			await expect(
				provider.transcribe({
					env: mockEnv,
					audio: mockAudio,
					user: mockUser,
				}),
			).rejects.toMatchObject({
				message: "Workers AI transcription error: AI service error",
				type: ErrorType.EXTERNAL_API_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("provider properties", () => {
		it("should have correct name", () => {
			expect(provider.name).toBe("workers");
		});

		it("should not require API key", () => {
			// @ts-ignore
			expect(provider.getProviderKeyName()).toBeUndefined();
		});
	});

	describe("Size Limits", () => {
		let provider: WorkersTranscriptionProvider;

		beforeEach(() => {
			provider = new WorkersTranscriptionProvider();
			vi.clearAllMocks();
		});

		describe("URL transcription with size limits", () => {
			it("should accept files under 25MB", async () => {
				const mockArrayBuffer = new ArrayBuffer(20 * 1024 * 1024); // 20MB

				global.fetch = vi.fn().mockResolvedValue({
					ok: true,
					headers: {
						get: vi.fn().mockReturnValue((20 * 1024 * 1024).toString()),
					},
					arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
				});

				(mockEnv.AI.run as any).mockResolvedValue({
					text: "Mock transcription result",
				});

				const result = await provider.transcribe({
					audio: "https://example.com/audio.mp3",
					env: mockEnv,
					user: mockUser,
					provider: "workers",
				});

				expect(result.text).toBe("Mock transcription result");
				expect(mockEnv.AI.run).toHaveBeenCalledWith(
					"@cf/openai/whisper",
					expect.objectContaining({
						audio: expect.any(Array),
					}),
					expect.any(Object),
				);
			});

			it("should reject files over 25MB", async () => {
				global.fetch = vi.fn().mockResolvedValue({
					ok: true,
					headers: {
						get: vi.fn().mockReturnValue((30 * 1024 * 1024).toString()), // 30MB
					},
				});

				await expect(
					provider.transcribe({
						audio: "https://example.com/large-audio.mp3",
						env: mockEnv,
						user: mockUser,
						provider: "workers",
					}),
				).rejects.toThrow(AssistantError);

				await expect(
					provider.transcribe({
						audio: "https://example.com/large-audio.mp3",
						env: mockEnv,
						user: mockUser,
						provider: "workers",
					}),
				).rejects.toThrow("File too large for Workers AI (30MB > 25MB)");
			});

			it("should handle missing content-length header", async () => {
				const mockArrayBuffer = new ArrayBuffer(10 * 1024 * 1024); // 10MB

				global.fetch = vi.fn().mockResolvedValue({
					ok: true,
					headers: {
						get: vi.fn().mockReturnValue(null), // No content-length header
					},
					arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
				});

				(mockEnv.AI.run as any).mockResolvedValue({
					text: "Mock transcription result",
				});

				const result = await provider.transcribe({
					audio: "https://example.com/audio.mp3",
					env: mockEnv,
					user: mockUser,
					provider: "workers",
				});

				expect(result.text).toBe("Mock transcription result");
			});
		});

		describe("Blob transcription with size limits", () => {
			it("should accept blobs under 25MB", async () => {
				const mockBlob = new Blob(["small content"], { type: "audio/mp3" });
				Object.defineProperty(mockBlob, "size", { value: 20 * 1024 * 1024 }); // 20MB

				(mockEnv.AI.run as any).mockResolvedValue({
					text: "Mock transcription result",
				});

				const result = await provider.transcribe({
					audio: mockBlob,
					env: mockEnv,
					user: mockUser,
					provider: "workers",
				});

				expect(result.text).toBe("Mock transcription result");
			});

			it("should reject blobs over 25MB", async () => {
				const mockBlob = new Blob(["large content"], { type: "audio/mp3" });
				Object.defineProperty(mockBlob, "size", { value: 30 * 1024 * 1024 }); // 30MB

				await expect(
					provider.transcribe({
						audio: mockBlob,
						env: mockEnv,
						user: mockUser,
						provider: "workers",
					}),
				).rejects.toThrow("File too large for Workers AI (30MB > 25MB)");
			});
		});
	});
});
