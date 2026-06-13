import { afterEach, describe, expect, it, vi } from "vitest";

import { executeSupabaseOperation } from "../supabase";

describe("executeSupabaseOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists Supabase organizations with bounded pagination", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeSupabaseOperation("token", "list_organizations", {
				offset: 10,
				limit: 500,
			}),
		).resolves.toEqual([]);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.supabase.com/v1/organizations?offset=10&limit=100",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("lists Supabase projects for an organization slug", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeSupabaseOperation("token", "list_projects", {
				organizationSlug: "acme-team",
				limit: 25,
			}),
		).resolves.toEqual([]);

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.supabase.com/v1/organizations/acme-team/projects?offset=0&limit=25",
		);
	});

	it("lists Supabase projects across accessible organizations when no slug is supplied", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeSupabaseOperation("token", "list_projects", {})).resolves.toEqual([]);

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe("https://api.supabase.com/v1/projects?offset=0&limit=20");
	});

	it("lists Edge Functions for a selected project", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeSupabaseOperation("token", "list_functions", {
				projectRef: "abcdefghijklmnopqrst",
			}),
		).resolves.toEqual([]);

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe("https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/functions");
	});

	it("lists database branches for a selected project", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeSupabaseOperation("token", "list_branches", {
				ref: "abcdefghijklmnopqrst",
			}),
		).resolves.toEqual([]);

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe("https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/branches");
	});

	it("requires a project ref before listing project resources", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeSupabaseOperation("token", "list_functions", {})).rejects.toThrow(
			"projectRef is required",
		);
		await expect(executeSupabaseOperation("token", "list_branches", {})).rejects.toThrow(
			"projectRef is required",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
