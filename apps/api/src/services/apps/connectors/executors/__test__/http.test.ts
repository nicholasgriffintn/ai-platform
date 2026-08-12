import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorType } from "~/utils/errors";
import { createConnectorJsonClient } from "../http";

describe("createConnectorJsonClient", () => {
	const fetchConnectorJson = createConnectorJsonClient("https://api.example.test/api/v1");
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
				path: "/api/v1/tasks",
				token: "provider-token",
			}),
		).rejects.toThrow(/"access_token":"\[redacted\]"/);
		await expect(
			fetchConnectorJson({
				path: "/api/v1/tasks",
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
				path: "/api/v1/projects/123/query/",
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

	it("rejects absolute and cross-origin request paths", async () => {
		const fetchMock = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			fetchConnectorJson({
				path: "https://attacker.example/api",
				token: "provider-token",
			}),
		).rejects.toThrow("Connector API path is invalid");

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
