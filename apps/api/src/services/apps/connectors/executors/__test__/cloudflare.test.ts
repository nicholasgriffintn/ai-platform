import { afterEach, describe, expect, it, vi } from "vitest";

import { executeCloudflareOperation } from "../cloudflare";

describe("executeCloudflareOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists Cloudflare accounts with bounded pagination", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ success: true, result: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeCloudflareOperation("token", "list_accounts", {
				name: "Polychat",
				page: 2,
				perPage: 500,
			}),
		).resolves.toEqual({ success: true, result: [] });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.cloudflare.com/client/v4/accounts?page=2&per_page=50&name=Polychat",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("lists zones with account and status filters", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ success: true, result: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeCloudflareOperation("token", "list_zones", {
				accountId: "account_123",
				name: "example.com",
				status: "active",
			}),
		).resolves.toEqual({ success: true, result: [] });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.cloudflare.com/client/v4/zones?page=1&per_page=20&name=example.com&status=active&account.id=account_123",
		);
	});

	it("lists Workers for an account", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ success: true, result: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeCloudflareOperation("token", "list_workers", {
				accountId: "account_123",
			}),
		).resolves.toEqual({ success: true, result: [] });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.cloudflare.com/client/v4/accounts/account_123/workers/scripts",
		);
	});

	it("lists Worker deployments for a script", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ success: true, result: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeCloudflareOperation("token", "list_worker_deployments", {
				accountId: "account_123",
				scriptName: "assistant-api",
			}),
		).resolves.toEqual({ success: true, result: [] });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.cloudflare.com/client/v4/accounts/account_123/workers/scripts/assistant-api/deployments",
		);
	});

	it("gets a selected Worker deployment", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () =>
				new Response(
					JSON.stringify({ success: true, result: { id: "deployment_123", latest: true } }),
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeCloudflareOperation("token", "get_worker_deployment", {
				accountId: "account_123",
				scriptName: "assistant-api",
				deploymentId: "deployment_123",
			}),
		).resolves.toEqual({ success: true, result: { id: "deployment_123", latest: true } });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://api.cloudflare.com/client/v4/accounts/account_123/workers/scripts/assistant-api/deployments/deployment_123",
		);
	});

	it("rejects failed Cloudflare response envelopes", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ success: false, errors: [{ code: 1000 }] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeCloudflareOperation("token", "list_accounts", {})).rejects.toThrow(
			"Cloudflare API request failed",
		);
	});

	it("requires account and script identifiers before fetching deployment data", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ success: true, result: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeCloudflareOperation("token", "list_workers", {})).rejects.toThrow(
			"accountId is required",
		);
		await expect(
			executeCloudflareOperation("token", "list_worker_deployments", {
				accountId: "account_123",
			}),
		).rejects.toThrow("scriptName is required");
		await expect(
			executeCloudflareOperation("token", "get_worker_deployment", {
				accountId: "account_123",
				scriptName: "assistant-api",
			}),
		).rejects.toThrow("deploymentId is required");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
