import { afterEach, describe, expect, it, vi } from "vitest";

import { executeVercelOperation } from "../vercel";

describe("executeVercelOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists Vercel projects for a team scope with bounded pagination", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeVercelOperation("token", "list_projects", {
				teamId: "team_123",
				repoUrl: "https://github.com/acme/app",
				limit: 500,
			}),
		).resolves.toEqual([]);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.vercel.com/v9/projects?teamId=team_123&repoUrl=https%3A%2F%2Fgithub.com%2Facme%2Fapp&limit=100",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("lists Vercel deployments with project, branch, target, and state filters", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ deployments: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeVercelOperation("token", "list_deployments", {
				slug: "acme",
				projectId: "prj_123",
				branch: "main",
				target: "production",
				state: "READY,ERROR",
				since: 1760000000000,
				limit: 1000,
			}),
		).resolves.toEqual({ deployments: [] });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.vercel.com/v6/deployments?slug=acme&target=production&state=READY%2CERROR&branch=main&since=1760000000000&projectId=prj_123&limit=100",
		);
	});

	it("retrieves deployment events for a selected deployment", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeVercelOperation("token", "get_deployment_events", {
				deploymentId: "dpl_123",
				buildId: "bld_456",
				direction: "backward",
				limit: 250,
			}),
		).resolves.toEqual([]);

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.vercel.com/v3/deployments/dpl_123/events?direction=backward&name=bld_456&limit=100",
		);
	});

	it("requires a deployment id or url before fetching events", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeVercelOperation("token", "get_deployment_events", {})).rejects.toThrow(
			"idOrUrl is required",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
