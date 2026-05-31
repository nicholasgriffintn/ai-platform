import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { createMistralRealtimeProxyResponse } from "~/services/realtime/mistral";

const loggerMock = vi.hoisted(() => ({
	error: vi.fn(),
}));
const fetchMock = vi.fn();
const getApiKeyMock = vi.fn();
const getDefaultModelMock = vi.fn();
const testEnv = {} as IEnv;
const testUser = {
	id: 1,
	name: null,
	avatar_url: null,
	email: "test@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-05-27T00:00:00.000Z",
	updated_at: "2026-05-27T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: null,
} satisfies IUser;

vi.mock("~/lib/providers/capabilities/realtime", () => ({
	getRealtimeProvider: vi.fn(() => ({
		getApiKey: getApiKeyMock,
		getDefaultModel: getDefaultModelMock,
	})),
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => loggerMock),
}));

async function requestProxyResponse(model?: string): Promise<Response> {
	const app = new Hono();
	app.get("/realtime/mistral/transcription", (context) =>
		createMistralRealtimeProxyResponse({
			context,
			env: testEnv,
			user: testUser,
			model,
		}),
	);

	return app.request(
		new Request("https://api.polychat.test/realtime/mistral/transcription", {
			headers: { Upgrade: "websocket" },
		}),
	);
}

describe("createMistralRealtimeProxyResponse", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loggerMock.error.mockClear();
		vi.stubGlobal("fetch", fetchMock);
		getApiKeyMock.mockResolvedValue("test-key");
		getDefaultModelMock.mockReturnValue("voxtral-mini-transcribe-realtime-latest");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("preserves upstream authentication failures during websocket handshake", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ detail: "Unauthorized" }), {
				headers: { "mistral-correlation-id": "corr-123" },
				status: 401,
				statusText: "Unauthorized",
			}),
		);

		const response = await requestProxyResponse("voxtral-mini-transcribe-realtime-latest");

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			status: "error",
			message:
				'Failed to connect to Mistral realtime: 401 Unauthorized - {"detail":"Unauthorized"} - correlation_id=corr-123',
		});
		expect(loggerMock.error).toHaveBeenCalledWith("Mistral realtime handshake failed", {
			model: "voxtral-mini-transcribe-realtime-latest",
			providerStatus: 401,
			providerStatusText: "Unauthorized",
			providerResponse:
				'Failed to connect to Mistral realtime: 401 Unauthorized - {"detail":"Unauthorized"}',
			providerCorrelationId: "corr-123",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			expect.objectContaining({
				href: "https://api.mistral.ai/v1/audio/transcriptions/realtime?model=voxtral-mini-transcribe-realtime-latest",
			}),
			expect.objectContaining({
				headers: {
					Authorization: "Bearer test-key",
					Upgrade: "websocket",
				},
			}),
		);
	});

	it("returns bad gateway for upstream server handshake failures", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 503, statusText: "Busy" }));

		const response = await requestProxyResponse();

		expect(response.status).toBe(502);
	});
});
