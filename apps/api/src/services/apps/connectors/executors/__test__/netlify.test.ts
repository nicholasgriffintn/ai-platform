import { afterEach, describe, expect, it, vi } from "vitest";

import { executeNetlifyOperation } from "../netlify";

describe("executeNetlifyOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists Netlify sites with bounded pagination", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeNetlifyOperation("token", "list_sites", {
				page: 2,
				perPage: 500,
			}),
		).resolves.toEqual([]);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.netlify.com/api/v1/sites?page=2&per_page=100",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("lists deploys for a selected site", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeNetlifyOperation("token", "list_deploys", {
				siteId: "site.example.com",
				page: 1,
				perPage: 25,
			}),
		).resolves.toEqual([]);

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.netlify.com/api/v1/sites/site.example.com/deploys?page=1&per_page=25",
		);
	});

	it("gets deployment status by deploy id", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ id: "deploy_123", state: "ready" })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeNetlifyOperation("token", "get_deploy", {
				deployId: "deploy_123",
			}),
		).resolves.toEqual({ id: "deploy_123", state: "ready" });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe("https://api.netlify.com/api/v1/deploys/deploy_123");
	});

	it("requires a site id before listing deploys", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeNetlifyOperation("token", "list_deploys", {})).rejects.toThrow(
			"siteId is required",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("requires a deploy id before fetching deploy status", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({})));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeNetlifyOperation("token", "get_deploy", {})).rejects.toThrow(
			"deployId is required",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
