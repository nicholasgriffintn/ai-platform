import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import realtimeRoutes from "../realtime";
import type { IUser } from "~/types";

const createSessionMock = vi.hoisted(() => vi.fn());
const createCartesiaRealtimeProxyResponseMock = vi.hoisted(() => vi.fn());
const createElevenLabsRealtimeProxyResponseMock = vi.hoisted(() => vi.fn());
const createMistralRealtimeProxyResponseMock = vi.hoisted(() => vi.fn());
const getDefaultModelMock = vi.hoisted(() => vi.fn());
const listModelsMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/providers/capabilities/realtime", () => ({
	getRealtimeProvider: vi.fn(() => ({
		createSession: createSessionMock,
		getDefaultModel: getDefaultModelMock,
	})),
	listRealtimeProviders: vi.fn(() => ["openai", "mistral"]),
	parseRealtimeModalities: vi.fn(() => undefined),
	parseRealtimeTranscriptionDelay: vi.fn(() => undefined),
	parseRealtimeTransport: vi.fn(() => undefined),
}));

vi.mock("~/services/models", () => ({
	listModels: listModelsMock,
}));

vi.mock("~/services/realtime/mistral", () => ({
	createMistralRealtimeProxyResponse: createMistralRealtimeProxyResponseMock,
}));

vi.mock("~/services/realtime/elevenlabs", () => ({
	createElevenLabsRealtimeProxyResponse: createElevenLabsRealtimeProxyResponseMock,
}));

vi.mock("~/services/realtime/cartesia", () => ({
	createCartesiaRealtimeProxyResponse: createCartesiaRealtimeProxyResponseMock,
}));

const testUser: IUser = {
	id: 42,
	name: "Test User",
	avatar_url: null,
	email: "test@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-06-02T00:00:00.000Z",
	updated_at: "2026-06-02T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "free",
};

function createApp(user: IUser = testUser) {
	const app = new Hono<{
		Variables: {
			user: IUser;
		};
	}>();

	app.use("/realtime/*", async (c, next) => {
		c.set("user", user);
		await next();
	});

	app.route("/realtime", realtimeRoutes);

	return app;
}

describe("realtime routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getDefaultModelMock.mockReturnValue("gpt-realtime-2");
	});

	it("blocks session creation when the user cannot access the realtime model", async () => {
		listModelsMock.mockResolvedValue({
			"deepseek-v4-flash": {
				matchingModel: "deepseek-v4-flash",
				name: "DeepSeek Chat",
				provider: "deepseek",
			},
		});

		const response = await createApp().request(
			new Request("https://api.polychat.test/realtime/session/realtime?provider=openai", {
				method: "POST",
			}),
		);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			status: "error",
			message: "Model not found or user does not have access",
		});
		expect(createSessionMock).not.toHaveBeenCalled();
	});

	it("allows session creation when the default realtime model is accessible", async () => {
		listModelsMock.mockResolvedValue({
			"gpt-realtime-2": {
				matchingModel: "gpt-realtime-2",
				name: "GPT Realtime 2",
				provider: "openai",
			},
		});
		createSessionMock.mockResolvedValue({
			id: "session_123",
			provider: "openai",
			transport: "webrtc",
		});

		const response = await createApp().request(
			new Request("https://api.polychat.test/realtime/session/realtime?provider=openai", {
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			id: "session_123",
			provider: "openai",
			transport: "webrtc",
		});
		expect(createSessionMock).toHaveBeenCalledWith(
			expect.objectContaining({
				model: undefined,
				type: "realtime",
				user: testUser,
			}),
		);
	});

	it("blocks composed pipeline creation when any stage model is inaccessible", async () => {
		listModelsMock.mockResolvedValue({
			"voxtral-mini-transcribe-realtime": {
				matchingModel: "voxtral-mini-transcribe-realtime-2602",
				name: "Voxtral Mini Transcribe Realtime",
				provider: "mistral",
			},
			"deepseek-v4-flash": {
				matchingModel: "deepseek-v4-flash",
				name: "DeepSeek Chat",
				provider: "deepseek",
			},
		});
		createSessionMock.mockResolvedValue({
			id: "transcription_session_123",
			object: "realtime.transcription.session",
			provider: "mistral",
			transport: "websocket",
		});

		const response = await createApp().request(
			new Request("https://api.polychat.test/realtime/pipeline/session", {
				method: "POST",
				body: JSON.stringify({
					input: {
						provider: "mistral",
						model: "voxtral-mini-transcribe-realtime",
					},
					reasoning: {
						provider: "deepseek",
						model: "deepseek-v4-flash",
					},
					output: {
						provider: "cartesia",
						model: "sonic-3",
					},
				}),
				headers: {
					"content-type": "application/json",
				},
			}),
		);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			status: "error",
			message: "Output model not found or user does not have access",
		});
		expect(createSessionMock).not.toHaveBeenCalled();
	});

	it("blocks composed pipeline creation when any stage provider does not match its model", async () => {
		listModelsMock.mockResolvedValue({
			"voxtral-mini-transcribe-realtime": {
				matchingModel: "voxtral-mini-transcribe-realtime-2602",
				name: "Voxtral Mini Transcribe Realtime",
				provider: "mistral",
			},
			"deepseek-v4-flash": {
				matchingModel: "deepseek-v4-flash",
				name: "DeepSeek Chat",
				provider: "deepseek",
			},
			"sonic-3": {
				matchingModel: "sonic-3",
				name: "Sonic 3",
				provider: "cartesia",
			},
		});

		const response = await createApp().request(
			new Request("https://api.polychat.test/realtime/pipeline/session", {
				method: "POST",
				body: JSON.stringify({
					input: {
						provider: "mistral",
						model: "voxtral-mini-transcribe-realtime",
					},
					reasoning: {
						provider: "bogus",
						model: "deepseek-v4-flash",
					},
					output: {
						provider: "cartesia",
						model: "sonic-3",
					},
				}),
				headers: {
					"content-type": "application/json",
				},
			}),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			status: "error",
			message: "Reasoning model does not belong to bogus",
		});
		expect(createSessionMock).not.toHaveBeenCalled();
	});

	it("blocks composed pipeline creation when a stage model belongs to another provider", async () => {
		listModelsMock.mockResolvedValue({
			"voxtral-mini-transcribe-realtime": {
				matchingModel: "voxtral-mini-transcribe-realtime-2602",
				name: "Voxtral Mini Transcribe Realtime",
				provider: "mistral",
			},
			"deepseek-v4-flash": {
				matchingModel: "deepseek-v4-flash",
				name: "DeepSeek Chat",
				provider: "deepseek",
			},
			"sonic-3": {
				matchingModel: "sonic-3",
				name: "Sonic 3",
				provider: "cartesia",
			},
		});

		const response = await createApp().request(
			new Request("https://api.polychat.test/realtime/pipeline/session", {
				method: "POST",
				body: JSON.stringify({
					input: {
						provider: "mistral",
						model: "voxtral-mini-transcribe-realtime",
					},
					reasoning: {
						provider: "deepseek",
						model: "deepseek-v4-flash",
					},
					output: {
						provider: "mistral",
						model: "sonic-3",
					},
				}),
				headers: {
					"content-type": "application/json",
				},
			}),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			status: "error",
			message: "Output model does not belong to mistral",
		});
		expect(createSessionMock).not.toHaveBeenCalled();
	});

	it("creates a composed pipeline session with validated stage models", async () => {
		listModelsMock.mockResolvedValue({
			"voxtral-mini-transcribe-realtime": {
				matchingModel: "voxtral-mini-transcribe-realtime-2602",
				name: "Voxtral Mini Transcribe Realtime",
				provider: "mistral",
			},
			"deepseek-v4-flash": {
				matchingModel: "deepseek-v4-flash",
				name: "DeepSeek Chat",
				provider: "deepseek",
			},
			"sonic-3": {
				matchingModel: "sonic-3",
				name: "Sonic 3",
				provider: "cartesia",
			},
		});
		createSessionMock.mockResolvedValue({
			id: "transcription_session_123",
			object: "realtime.transcription.session",
			provider: "mistral",
			transport: "websocket",
		});

		const response = await createApp().request(
			new Request("https://api.polychat.test/realtime/pipeline/session", {
				method: "POST",
				body: JSON.stringify({
					input: {
						provider: "mistral",
						model: "voxtral-mini-transcribe-realtime",
					},
					reasoning: {
						provider: "deepseek",
						model: "deepseek-v4-flash",
					},
					output: {
						provider: "cartesia",
						model: "sonic-3",
						voice: "sonic-3",
					},
				}),
				headers: {
					"content-type": "application/json",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			id: expect.any(String),
			object: "realtime.pipeline.session",
			type: "pipeline",
			live_mode: "composed",
			input: {
				provider: "mistral",
				model: "voxtral-mini-transcribe-realtime",
				session: {
					id: "transcription_session_123",
					object: "realtime.transcription.session",
					provider: "mistral",
					transport: "websocket",
				},
			},
			reasoning: {
				provider: "deepseek",
				model: "deepseek-v4-flash",
			},
			output: {
				provider: "cartesia",
				model: "sonic-3",
				voice: "sonic-3",
			},
			latency_profile: "balanced",
		});
		expect(createSessionMock).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "voxtral-mini-transcribe-realtime",
				type: "transcription",
				user: testUser,
			}),
		);
	});
});
