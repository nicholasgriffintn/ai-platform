import { afterEach, describe, expect, it, vi } from "vitest";

import { executePostHogOperation } from "../posthog";

describe("executePostHogOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists PostHog projects with an allowed cloud region", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ results: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executePostHogOperation("token", "list_projects", {
				region: "eu",
				organizationId: "org-1",
				search: "mobile",
				limit: 500,
			}),
		).resolves.toEqual({ results: [] });

		const [url, init] = fetchMock.mock.calls[0] ?? ["", undefined];
		expect(String(url)).toBe(
			"https://eu.posthog.com/api/organizations/org-1/projects/?search=mobile&limit=100",
		);
		expect(init).toEqual(
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("runs bounded read-only HogQL queries", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ results: [["signup", 10]] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executePostHogOperation("token", "query", {
				projectId: "123",
				query: "select event, count() from events group by event order by count() desc",
				limit: 1000,
			}),
		).resolves.toEqual({ results: [["signup", 10]] });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://us.posthog.com/api/projects/123/query/",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					query: {
						kind: "HogQLQuery",
						query:
							"select event, count() from events group by event order by count() desc LIMIT 500",
					},
				}),
			}),
		);
	});

	it("accepts PostHog API-shaped HogQL query objects", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ results: [["signup", 10]] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executePostHogOperation("token", "query", {
				projectId: "123",
				query: {
					kind: "HogQLQuery",
					query: "SELECT event, count() FROM events GROUP BY event LIMIT 10",
				},
			}),
		).resolves.toEqual({ results: [["signup", 10]] });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://us.posthog.com/api/projects/123/query/",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					query: {
						kind: "HogQLQuery",
						query: "SELECT event, count() FROM events GROUP BY event LIMIT 10",
					},
				}),
			}),
		);
	});

	it("clamps excessive inline HogQL limits", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ results: [["signup", 10]] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executePostHogOperation("token", "query", {
				projectId: "123",
				query: "SELECT event, count() FROM events GROUP BY event LIMIT 1000",
			}),
		).resolves.toEqual({ results: [["signup", 10]] });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://us.posthog.com/api/projects/123/query/",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					query: {
						kind: "HogQLQuery",
						query: "SELECT event, count() FROM events GROUP BY event LIMIT 500",
					},
				}),
			}),
		);
	});

	it("rejects mutating HogQL keywords", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ results: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executePostHogOperation("token", "query", {
				projectId: "123",
				query: "delete from events where 1 = 1",
			}),
		).rejects.toThrow("query must be read-only");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects unsupported PostHog regions", async () => {
		await expect(
			executePostHogOperation("token", "list_projects", {
				region: "https://posthog.internal",
				organizationId: "org-1",
			}),
		).rejects.toThrow("region must be us, eu, or app");
	});
});
