import { afterEach, describe, expect, it, vi } from "vitest";

import { executeWebflowOperation } from "../webflow";

describe("executeWebflowOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists Webflow sites", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ sites: [] })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeWebflowOperation("token", "list_sites", {})).resolves.toEqual({
			sites: [],
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.webflow.com/v2/sites",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("lists CMS collections for a selected site", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ collections: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeWebflowOperation("token", "list_collections", {
				siteId: "site_123",
			}),
		).resolves.toEqual({ collections: [] });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe("https://api.webflow.com/v2/sites/site_123/collections");
	});

	it("lists CMS items with bounded filters", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ items: [] })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeWebflowOperation("token", "list_items", {
				collectionId: "collection_123",
				offset: 10,
				limit: 500,
				cmsLocaleId: "locale_123",
				name: "Launch",
				slug: "launch",
				sortBy: "lastPublished",
				sortOrder: "asc",
			}),
		).resolves.toEqual({ items: [] });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.webflow.com/v2/collections/collection_123/items?offset=10&limit=100&cmsLocaleId=locale_123&name=Launch&slug=launch&sortBy=lastPublished&sortOrder=asc",
		);
	});

	it("requires identifiers before fetching nested Webflow resources", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ collections: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeWebflowOperation("token", "list_collections", {})).rejects.toThrow(
			"siteId is required",
		);
		await expect(executeWebflowOperation("token", "list_items", {})).rejects.toThrow(
			"collectionId is required",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
