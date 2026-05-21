import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchApi } from "../fetch-wrapper";

describe("fetchApi", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("does not abort requests when timeoutMs is null", async () => {
		let capturedSignal: AbortSignal | undefined;
		let resolveFetch: ((response: Response) => void) | undefined;

		vi.stubGlobal(
			"fetch",
			vi.fn((_url: string, init?: RequestInit) => {
				capturedSignal = init?.signal ?? undefined;
				return new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				});
			}),
		);

		const request = fetchApi("/audio/speech", {
			method: "POST",
			body: { input: "hello" },
			timeoutMs: null,
		});

		await vi.advanceTimersByTimeAsync(15_000);

		expect(capturedSignal).toBeUndefined();

		resolveFetch?.(new Response("{}"));
		await expect(request).resolves.toBeInstanceOf(Response);
	});

	it("keeps the default timeout for requests without an explicit timeout override", async () => {
		let capturedSignal: AbortSignal | undefined;
		let resolveFetch: ((response: Response) => void) | undefined;

		vi.stubGlobal(
			"fetch",
			vi.fn((_url: string, init?: RequestInit) => {
				capturedSignal = init?.signal ?? undefined;
				return new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				});
			}),
		);

		const request = fetchApi("/models", { method: "GET" });

		await vi.advanceTimersByTimeAsync(15_000);

		expect(capturedSignal?.aborted).toBe(true);

		resolveFetch?.(new Response("{}"));
		await expect(request).resolves.toBeInstanceOf(Response);
	});
});
