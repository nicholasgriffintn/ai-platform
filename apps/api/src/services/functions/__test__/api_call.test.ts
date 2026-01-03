import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { call_api } from "../api_call";
import type { IRequest } from "~/types";

const baseRequest: IRequest = {
	env: {} as any,
	user: { id: 1 } as any,
};

const createMockResponse = ({
	ok = true,
	status = 200,
	statusText = "OK",
	contentType = "application/json",
	body = "{}",
}: {
	ok?: boolean;
	status?: number;
	statusText?: string;
	contentType?: string;
	body?: string;
}) =>
	({
		ok,
		status,
		statusText,
		headers: {
			get: vi.fn((key: string) =>
				key.toLowerCase() === "content-type" ? contentType : null,
			),
			forEach: (cb: (value: string, key: string) => void) => {
				cb(contentType, "content-type");
			},
		},
		text: vi.fn().mockResolvedValue(body),
	}) as unknown as Response;

describe("call_api function", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("returns an error for invalid URLs", async () => {
		const result = await call_api.function(
			"id",
			{ url: "not-a-url" },
			baseRequest,
		);

		expect(result.status).toBe("error");
		expect(result.content).toBe("Invalid URL format");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("executes a REST GET request with query params", async () => {
		vi.mocked(fetch).mockResolvedValue(
			createMockResponse({
				body: JSON.stringify({ hello: "world" }),
			}),
		);

		const result = await call_api.function(
			"id",
			{
				url: "https://example.com/api",
				query_params: { q: "test", page: 2 },
			},
			baseRequest,
		);

		expect(fetch).toHaveBeenCalledWith(
			"https://example.com/api?q=test&page=2",
			expect.objectContaining({ method: "GET" }),
		);
		expect(result.status).toBe("success");
		expect(result.data?.body).toEqual({ hello: "world" });
		expect(result.data?.body_format).toBe("json");
	});

	it("executes a GraphQL request with variables", async () => {
		vi.mocked(fetch).mockResolvedValue(
			createMockResponse({
				body: JSON.stringify({ data: { viewer: { id: "1" } } }),
			}),
		);

		const result = await call_api.function(
			"id",
			{
				request_type: "graphql",
				url: "https://example.com/graphql",
				graphql_query: "query GetViewer { viewer { id } }",
				graphql_variables: { id: "1" },
				headers: { Authorization: "Bearer token" },
			},
			baseRequest,
		);

		expect(fetch).toHaveBeenCalledWith(
			"https://example.com/graphql",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
					"Content-Type": "application/json",
				}),
			}),
		);

		const fetchArgs = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
		const parsedBody = fetchArgs?.body
			? JSON.parse(fetchArgs.body as string)
			: null;

		expect(parsedBody).toEqual({
			query: "query GetViewer { viewer { id } }",
			variables: { id: "1" },
			operationName: undefined,
		});

		expect(result.status).toBe("success");
		expect(result.data?.body).toEqual({ data: { viewer: { id: "1" } } });
	});
});
