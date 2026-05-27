import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getModelConfigByModel } from "~/lib/providers/models";
import { GoogleRealtimeProvider } from "~/lib/providers/capabilities/realtime/providers";
import { AssistantError } from "~/utils/errors";

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByModel: vi.fn(),
}));

const fetchMock = vi.fn();

describe("GoogleRealtimeProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-26T12:00:00.000Z"));
		vi.stubGlobal("fetch", fetchMock);
		vi.mocked(getModelConfigByModel).mockResolvedValue({
			matchingModel: "gemini-3.1-flash-live-preview",
			name: "Gemini 3.1 Flash Live Preview",
			provider: "google-ai-studio",
			modalities: { input: ["text", "audio"], output: ["text", "audio"] },
		});
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					name: "authTokens/live-token",
					expireTime: "2026-05-26T12:30:00.000Z",
					newSessionExpireTime: "2026-05-26T12:01:00.000Z",
				}),
				{ status: 200 },
			),
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("creates a constrained Gemini Live session token", async () => {
		const provider = new GoogleRealtimeProvider();

		const session = await provider.createSession({
			env: { GOOGLE_STUDIO_API_KEY: "test-key" } as any,
			user: { id: 1 } as any,
			type: "realtime",
			instructions: "Be concise.",
			voice: "Puck",
			inputModalities: ["audio", "video"],
		});

		expect(getModelConfigByModel).toHaveBeenCalledWith(
			"gemini-3.1-flash-live-preview",
			expect.any(Object),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://generativelanguage.googleapis.com/v1alpha/authTokens",
			expect.objectContaining({
				method: "POST",
				headers: {
					"x-goog-api-key": "test-key",
					"Content-Type": "application/json",
				},
			}),
		);

		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			authToken: {
				uses: 1,
				expireTime: "2026-05-26T12:30:00.000Z",
				newSessionExpireTime: "2026-05-26T12:01:00.000Z",
				bidiGenerateContentSetup: {
					model: "gemini-3.1-flash-live-preview",
					generationConfig: {
						responseModalities: ["AUDIO"],
						speechConfig: {
							voiceConfig: {
								prebuiltVoiceConfig: {
									voiceName: "Puck",
								},
							},
						},
					},
					realtimeInputConfig: {
						turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
					},
					systemInstruction: {
						parts: [{ text: "Be concise." }],
					},
				},
			},
		});
		expect(session).toEqual({
			id: "authTokens/live-token",
			object: "realtime.session",
			type: "realtime",
			provider: "google-ai-studio",
			transport: "websocket",
			protocol: "gemini-live",
			model: "gemini-3.1-flash-live-preview",
			input_modalities: ["audio", "video"],
			output_modalities: ["audio"],
			modalities: ["audio"],
			audio: {
				input: {
					format: {
						type: "audio/pcm",
						rate: 16000,
					},
				},
				output: {
					format: {
						type: "audio/pcm",
						rate: 24000,
					},
					voice: "Puck",
				},
			},
			client_secret: {
				value: "authTokens/live-token",
				expires_at: 1779798600,
			},
			url: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=authTokens%2Flive-token",
			setup: {
				model: "gemini-3.1-flash-live-preview",
				generationConfig: {
					responseModalities: ["AUDIO"],
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: {
								voiceName: "Puck",
							},
						},
					},
				},
				realtimeInputConfig: {
					turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
				},
				systemInstruction: {
					parts: [{ text: "Be concise." }],
				},
			},
		});
	});

	it("rejects non-live session types", async () => {
		const provider = new GoogleRealtimeProvider();

		await expect(
			provider.createSession({
				env: { GOOGLE_STUDIO_API_KEY: "test-key" } as any,
				user: { id: 1 } as any,
				type: "transcription",
			}),
		).rejects.toThrow(AssistantError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("configures Gemini Live sessions for text output", async () => {
		const provider = new GoogleRealtimeProvider();

		const session = await provider.createSession({
			env: { GOOGLE_STUDIO_API_KEY: "test-key" } as any,
			user: { id: 1 } as any,
			type: "realtime",
			outputModalities: ["text"],
		});

		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body).authToken.bidiGenerateContentSetup).toEqual({
			model: "gemini-3.1-flash-live-preview",
			generationConfig: {
				responseModalities: ["TEXT"],
			},
		});
		expect(session).toMatchObject({
			transport: "websocket",
			protocol: "gemini-live",
			input_modalities: ["audio"],
			output_modalities: ["text"],
			modalities: ["text"],
		});
		expect((session as any).audio.output).toBeUndefined();
	});
});
