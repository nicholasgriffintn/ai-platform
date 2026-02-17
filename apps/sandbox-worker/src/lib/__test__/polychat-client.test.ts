import { afterEach, describe, expect, it, vi } from "vitest";

import { PolychatClient } from "../polychat-client";

describe("PolychatClient", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("sends authorization and user-agent headers", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
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
		vi.stubGlobal("fetch", fetchMock);

		const client = new PolychatClient("http://localhost:8787", "token-123");
		const result = await client.chatCompletion({
			messages: [{ role: "user", content: "hello" }],
			model: "mistral-large",
		});

		expect(result).toBe("ok");
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const [, requestInit] = fetchMock.mock.calls[0] as [
			string,
			RequestInit | undefined,
		];
		const headers = requestInit?.headers as Record<string, string>;

		expect(headers.Authorization).toBe("Bearer token-123");
		expect(headers["User-Agent"]).toBe(
			"Polychat-Sandbox-Worker/1.0 (+https://polychat.app)",
		);
	});
});
