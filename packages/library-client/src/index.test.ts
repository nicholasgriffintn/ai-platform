import { describe, expect, it, vi } from "vitest";

import { createPolychatClient } from "./index";

describe("createPolychatClient", () => {
	it("injects transport, auth policy, CSRF, and serialises object bodies", async () => {
		const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
		const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			requests.push([input, init]);
			return new Response(JSON.stringify({ data: { ok: true } }));
		});
		const client = createPolychatClient({
			baseUrl: "https://api.polychat.test/",
			fetch,
			credentials: "include",
			getCsrfToken: () => "csrf-token",
		});

		const response = await client.fetch("/messages", { method: "POST", body: { text: "hi" } });
		await expect(client.read(response)).resolves.toEqual({ ok: true });
		expect(fetch).toHaveBeenCalledWith(
			"https://api.polychat.test/messages",
			expect.objectContaining({
				body: JSON.stringify({ text: "hi" }),
				credentials: "include",
			}),
		);
		const request = requests[0]?.[1];
		expect(new Headers(request?.headers).get("X-CSRF-Token")).toBe("csrf-token");
	});

	it("throws a structured API error for failed responses", async () => {
		const client = createPolychatClient({
			baseUrl: "https://api.polychat.test",
			fetch: async () =>
				new Response(JSON.stringify({ error: { code: "forbidden", message: "No access" } }), {
					status: 403,
				}),
		});

		await expect(client.fetchOrThrow("/private")).rejects.toEqual(
			expect.objectContaining({ status: 403, code: "forbidden", message: "No access" }),
		);
	});

	it("honours the default timeout without overriding caller signals", async () => {
		vi.useFakeTimers();
		let signal: AbortSignal | null | undefined;
		const client = createPolychatClient({
			baseUrl: "https://api.polychat.test",
			fetch: async (_url, init) => {
				signal = init?.signal;
				return new Promise<Response>(() => undefined);
			},
			defaultTimeoutMs: 20,
		});
		void client.fetch("/slow");
		await vi.advanceTimersByTimeAsync(20);
		expect(signal?.aborted).toBe(true);
		vi.useRealTimers();
	});

	it.each(["https://attacker.example/messages", "//attacker.example/messages"])(
		"rejects cross-origin request path %s before resolving credentials",
		async (path) => {
			const fetch = vi.fn();
			const getHeaders = vi.fn(() => ({ Authorization: "Bearer secret" }));
			const client = createPolychatClient({
				baseUrl: "https://api.polychat.test",
				fetch,
				getHeaders,
			});

			await expect(client.fetch(path)).rejects.toThrow("must remain on the configured API origin");
			expect(fetch).not.toHaveBeenCalled();
			expect(getHeaders).not.toHaveBeenCalled();
		},
	);
});
