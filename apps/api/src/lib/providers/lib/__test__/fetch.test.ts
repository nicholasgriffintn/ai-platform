import { describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchAIResponse } from "../fetch";

describe("fetchAIResponse", () => {
	it("sends JSON-compatible bodies through the provider Gateway endpoint", async () => {
		const getUrl = vi.fn(async () => "https://gateway.ai.cloudflare.com/v1/account/gateway/groq");
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ choices: [] }), {
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				}),
		);
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock as typeof fetch;

		const env = {
			AI: {
				gateway: vi.fn(() => ({ getUrl })),
			},
		};

		try {
			await fetchAIResponse(
				false,
				"groq",
				"chat/completions",
				{},
				{
					model: "llama-3.3-70b-versatile",
					messages: [{ role: "user", content: "Hello", name: undefined }],
					store: undefined,
					metadata: {
						keep: null,
						drop: undefined,
					},
					list: [undefined, { keep: "value", drop: undefined }],
				},
				env as unknown as IEnv,
			);
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(getUrl).toHaveBeenCalledWith("groq");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://gateway.ai.cloudflare.com/v1/account/gateway/groq/chat/completions",
			expect.objectContaining({
				body: JSON.stringify({
					model: "llama-3.3-70b-versatile",
					messages: [{ role: "user", content: "Hello" }],
					metadata: {
						keep: null,
					},
					list: [null, { keep: "value" }],
				}),
			}),
		);
	});

	it("uses the OpenAI provider endpoint instead of Universal Gateway", async () => {
		const getUrl = vi.fn(async () => "https://gateway.ai.cloudflare.com/v1/account/gateway/openai");
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ choices: [] }), {
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				}),
		);
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock as typeof fetch;

		const env = {
			AI: {
				gateway: vi.fn(() => ({ getUrl })),
			},
		};

		try {
			await fetchAIResponse(
				false,
				"openai",
				"chat/completions",
				{ Authorization: "Bearer test-key" },
				{
					model: "gpt-4.1",
					messages: [{ role: "user", content: "Hello" }],
				},
				env as unknown as IEnv,
			);
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(getUrl).toHaveBeenCalledWith("openai");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://gateway.ai.cloudflare.com/v1/account/gateway/openai/chat/completions",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					model: "gpt-4.1",
					messages: [{ role: "user", content: "Hello" }],
				}),
			}),
		);
	});

	it("uses the compat Gateway endpoint for OpenAI-compatible providers", async () => {
		const getUrl = vi.fn(async () => "https://gateway.ai.cloudflare.com/v1/account/gateway/compat");
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ choices: [] }), {
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				}),
		);
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock as typeof fetch;

		const env = {
			AI: {
				gateway: vi.fn(() => ({ getUrl })),
			},
		};

		try {
			await fetchAIResponse(
				true,
				"groq",
				"chat/completions",
				{ Authorization: "Bearer test-key" },
				{
					model: "groq/llama-3.3-70b-versatile",
					messages: [{ role: "user", content: "Hello" }],
				},
				env as unknown as IEnv,
				{
					requestTimeout: 5000,
					maxAttempts: 2,
				},
			);
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(getUrl).toHaveBeenCalledWith("compat");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://gateway.ai.cloudflare.com/v1/account/gateway/compat/chat/completions",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-key",
					"cf-aig-request-timeout": "5000",
					"cf-aig-max-attempts": "2",
				}),
			}),
		);
	});

	it("classifies gateway-wrapped provider rate limits as rate limit errors", async () => {
		const getUrl = vi.fn(async () => "https://gateway.ai.cloudflare.com/v1/account/gateway/compat");
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						raw_status_code: 429,
						code: "1300",
						type: "rate_limited",
						message: "Rate limit exceeded",
					}),
					{
						status: 502,
						headers: {
							"content-type": "application/json",
						},
					},
				),
		);
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock as typeof fetch;

		const env = {
			AI: {
				gateway: vi.fn(() => ({ getUrl })),
			},
		};

		try {
			await expect(
				fetchAIResponse(
					true,
					"groq",
					"chat/completions",
					{ Authorization: "Bearer test-key" },
					{
						model: "groq/llama-3.3-70b-versatile",
						messages: [{ role: "user", content: "Hello" }],
					},
					env as unknown as IEnv,
				),
			).rejects.toMatchObject({
				name: "AssistantError",
				type: ErrorType.RATE_LIMIT_ERROR,
				message: "Rate limit exceeded",
			} satisfies Partial<AssistantError>);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
