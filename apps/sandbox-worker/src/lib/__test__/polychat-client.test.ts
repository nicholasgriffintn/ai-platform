import { afterEach, describe, expect, it, vi } from "vitest";

import { PolychatApiError, PolychatClient } from "../polychat-client";

describe("PolychatClient", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("sends authorization and user-agent headers", async () => {
		const serviceFetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					choices: [{ message: { content: "ok" } }],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		const client = new PolychatClient("token-123", {
			fetch: serviceFetchMock,
		});
		const result = await client.chatCompletion({
			messages: [{ role: "user", content: "hello" }],
			model: "mistral-large",
		});

		expect(result).toBe("ok");
		expect(serviceFetchMock).toHaveBeenCalledTimes(1);
		const request = serviceFetchMock.mock.calls[0][0] as Request;

		expect(request.url).toBe("http://polychat-api/chat/completions");
		expect(request.headers.get("Authorization")).toBe("Bearer token-123");
		expect(request.headers.get("User-Agent")).toBe(
			"Polychat-Sandbox-Worker/1.0 (+https://polychat.app)",
		);
	});

	it("retries retryable API failures", async () => {
		const serviceFetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response("temporary outage", {
					status: 503,
					headers: { "Content-Type": "text/plain" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						choices: [{ message: { content: "recovered" } }],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			);
		const client = new PolychatClient("token-123", {
			fetch: serviceFetchMock,
		});
		const result = await client.chatCompletion(
			{
				messages: [{ role: "user", content: "hello" }],
				model: "mistral-large",
			},
			{
				maxAttempts: 2,
				baseDelayMs: 1,
				maxDelayMs: 1,
			},
		);

		expect(result).toBe("recovered");
		expect(serviceFetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not retry non-retryable API failures", async () => {
		const serviceFetchMock = vi.fn().mockResolvedValue(
			new Response("bad request", {
				status: 400,
				headers: { "Content-Type": "text/plain" },
			}),
		);
		const client = new PolychatClient("token-123", {
			fetch: serviceFetchMock,
		});

		await expect(
			client.chatCompletion(
				{
					messages: [{ role: "user", content: "hello" }],
					model: "mistral-large",
				},
				{
					maxAttempts: 3,
					baseDelayMs: 1,
					maxDelayMs: 1,
				},
			),
		).rejects.toBeInstanceOf(PolychatApiError);
		expect(serviceFetchMock).toHaveBeenCalledTimes(1);
	});
});
