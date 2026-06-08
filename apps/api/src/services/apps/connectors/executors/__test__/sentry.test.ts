import { afterEach, describe, expect, it, vi } from "vitest";

import { executeSentryOperation } from "../sentry";

describe("executeSentryOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists connected Sentry organizations", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeSentryOperation("token", "list_organizations", {})).resolves.toEqual([]);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://sentry.io/api/0/organizations/",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("lists Sentry projects for an organization with bounded pagination", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeSentryOperation("token", "list_projects", {
				organizationSlug: "acme",
				query: "api",
				limit: 500,
			}),
		).resolves.toEqual([]);

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://sentry.io/api/0/organizations/acme/projects/?query=api&per_page=100",
		);
	});

	it("lists unresolved Sentry issues with project filters", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeSentryOperation("token", "list_issues", {
				organizationSlug: "acme",
				projectIds: ["123", "456"],
				query: "is:unresolved level:error",
				statsPeriod: "14d",
				limit: 10,
			}),
		).resolves.toEqual([]);

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://sentry.io/api/0/organizations/acme/issues/?query=is%3Aunresolved+level%3Aerror&statsPeriod=14d&sort=date&limit=10&project=123&project=456",
		);
	});

	it("retrieves a Sentry issue by ID", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ id: "issue-1" })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeSentryOperation("token", "retrieve_issue", {
				issueId: "issue-1",
			}),
		).resolves.toEqual({ id: "issue-1" });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe("https://sentry.io/api/0/issues/issue-1/");
	});

	it("requires an organization slug for organization-scoped Sentry reads", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeSentryOperation("token", "list_issues", {})).rejects.toThrow(
			"organizationSlug is required",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
