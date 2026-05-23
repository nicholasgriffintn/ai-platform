import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpenAIRealtimeProvider } from "~/lib/providers/capabilities/realtime/providers";
import { AssistantError } from "~/utils/errors";

const fetchMock = vi.fn();

describe("OpenAIRealtimeProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", fetchMock);
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					value: "ek_test",
					expires_at: 1779324000,
					session: {
						id: "sess_123",
						object: "realtime.transcription_session",
						type: "transcription",
					},
				}),
				{ status: 200 },
			),
		);
	});

	it("creates a low-latency realtime whisper transcription session by default", async () => {
		const provider = new OpenAIRealtimeProvider();

		const session = await provider.createSession({
			env: { OPENAI_API_KEY: "test-key" } as any,
			user: { id: 1 } as any,
			type: "transcription",
		});

		expect(session).toEqual({
			id: "sess_123",
			object: "realtime.transcription_session",
			type: "transcription",
			client_secret: {
				value: "ek_test",
				expires_at: 1779324000,
			},
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.openai.com/v1/realtime/client_secrets",
			expect.objectContaining({
				method: "POST",
				headers: {
					Authorization: "Bearer test-key",
					"Content-Type": "application/json",
				},
			}),
		);

		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			session: {
				type: "transcription",
				audio: {
					input: {
						format: {
							type: "audio/pcm",
							rate: 24000,
						},
						transcription: {
							model: "gpt-realtime-whisper",
							language: "en",
							delay: "low",
						},
						turn_detection: null,
					},
				},
			},
		});
	});

	it("creates a VAD-backed session for transcription models that support it", async () => {
		const provider = new OpenAIRealtimeProvider();

		await provider.createSession({
			env: { OPENAI_API_KEY: "test-key" } as any,
			user: { id: 1 } as any,
			type: "transcription",
			model: "gpt-4o-transcribe",
		});

		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			session: {
				type: "transcription",
				audio: {
					input: {
						format: {
							type: "audio/pcm",
							rate: 24000,
						},
						transcription: {
							model: "gpt-4o-transcribe",
							language: "en",
						},
						turn_detection: {
							type: "server_vad",
							threshold: 0.4,
							prefix_padding_ms: 400,
							silence_duration_ms: 1000,
						},
					},
				},
			},
		});
	});

	it("creates a realtime voice-agent session with the current default realtime model", async () => {
		const provider = new OpenAIRealtimeProvider();

		await provider.createSession({
			env: { OPENAI_API_KEY: "test-key" } as any,
			user: { id: 1 } as any,
			type: "realtime",
			instructions: "Be concise.",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.openai.com/v1/realtime/client_secrets",
			expect.any(Object),
		);
		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			session: {
				type: "realtime",
				model: "gpt-realtime-2",
				instructions: "Be concise.",
				audio: {
					input: {
						format: {
							type: "audio/pcm",
							rate: 24000,
						},
						turn_detection: {
							type: "server_vad",
							threshold: 0.4,
							prefix_padding_ms: 400,
							silence_duration_ms: 1000,
						},
					},
					output: {
						format: {
							type: "audio/pcm",
							rate: 24000,
						},
						voice: "marin",
					},
				},
			},
		});
	});

	it("creates a dedicated realtime translation session", async () => {
		const provider = new OpenAIRealtimeProvider();

		await provider.createSession({
			env: { OPENAI_API_KEY: "test-key" } as any,
			user: { id: 1 } as any,
			type: "translation",
			sourceLanguage: "fr",
			targetLanguage: "en",
			voice: "cedar",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.openai.com/v1/realtime/translations/client_secrets",
			expect.any(Object),
		);
		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			session: {
				type: "translation",
				model: "gpt-realtime-translate",
				audio: {
					input: {
						format: {
							type: "audio/pcm",
							rate: 24000,
						},
					},
					output: {
						format: {
							type: "audio/pcm",
							rate: 24000,
						},
						voice: "cedar",
					},
				},
				translation: {
					source_language: "fr",
					target_language: "en",
				},
			},
		});
	});

	it("maps the public whisper model id to OpenAI's realtime model id", async () => {
		const provider = new OpenAIRealtimeProvider();

		await provider.createSession({
			env: { OPENAI_API_KEY: "test-key" } as any,
			user: { id: 1 } as any,
			type: "transcription",
			model: "whisper",
		});

		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body).session.audio.input.transcription.model).toBe("whisper-1");
	});

	it("passes supported realtime whisper delay settings", async () => {
		const provider = new OpenAIRealtimeProvider();

		await provider.createSession({
			env: { OPENAI_API_KEY: "test-key" } as any,
			user: { id: 1 } as any,
			type: "transcription",
			model: "gpt-realtime-whisper",
			delay: "minimal",
		});

		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body).session.audio.input.transcription.delay).toBe("minimal");
	});

	it("rejects models outside the realtime provider model list", async () => {
		const provider = new OpenAIRealtimeProvider();

		await expect(
			provider.createSession({
				env: { OPENAI_API_KEY: "test-key" } as any,
				user: { id: 1 } as any,
				type: "transcription",
				model: "gpt-5.5",
			}),
		).rejects.toThrow(AssistantError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects models that are valid for a different realtime session type", async () => {
		const provider = new OpenAIRealtimeProvider();

		await expect(
			provider.createSession({
				env: { OPENAI_API_KEY: "test-key" } as any,
				user: { id: 1 } as any,
				type: "transcription",
				model: "gpt-realtime-2",
			}),
		).rejects.toThrow(AssistantError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("includes upstream response details when session creation fails", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: { message: "Unknown parameter: audio" } }), {
				status: 400,
				statusText: "Bad Request",
			}),
		);

		const provider = new OpenAIRealtimeProvider();

		await expect(
			provider.createSession({
				env: { OPENAI_API_KEY: "test-key" } as any,
				user: { id: 1 } as any,
				type: "transcription",
			}),
		).rejects.toMatchObject({
			message: "Failed to create realtime session: 400 Bad Request",
			context: {
				providerStatus: 400,
				providerResponse: JSON.stringify({ error: { message: "Unknown parameter: audio" } }),
			},
		});
	});
});
