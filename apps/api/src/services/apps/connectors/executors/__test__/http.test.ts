import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "../http";

describe("fetchConnectorJson", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("redacts sensitive connector error response text", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: "invalid_request",
							access_token: "Abcdef1234567890Ghijklm_Nopqrs",
						}),
						{ status: 400 },
					),
			),
		);

		await expect(
			fetchConnectorJson({
				url: "https://api.todoist.com/api/v1/tasks",
				token: "provider-token",
			}),
		).rejects.toThrow(/"access_token":"\[redacted\]"/);
		await expect(
			fetchConnectorJson({
				url: "https://api.todoist.com/api/v1/tasks",
				token: "provider-token",
			}),
		).rejects.not.toThrow("Abcdef1234567890Ghijklm_Nopqrs");
	});

	it("surfaces connector validation failures as correctable parameter errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () => new Response(JSON.stringify({ error: "invalid query shape" }), { status: 400 }),
			),
		);

		await expect(
			fetchConnectorJson({
				url: "https://us.posthog.com/api/projects/123/query/",
				token: "provider-token",
				method: "POST",
				body: {
					query: {
						kind: "HogQLQuery",
						query: "SELECT event FROM events LIMIT 10",
					},
				},
			}),
		).rejects.toMatchObject({
			type: ErrorType.PARAMS_ERROR,
			statusCode: 400,
		});
	});

	it("rejects connector HTTP calls outside supported provider hosts", async () => {
		const fetchMock = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			fetchConnectorJson({
				url: "https://example.com/api",
				token: "provider-token",
			}),
		).rejects.toThrow("Connector API URL is not supported");

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
