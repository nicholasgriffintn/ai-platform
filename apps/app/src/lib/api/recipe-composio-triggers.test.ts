import { afterEach, describe, expect, it, vi } from "vitest";

import {
	deleteRecipeComposioTrigger,
	listRecipeComposioTriggers,
	listRecipeComposioTriggerTypes,
	updateRecipeComposioTrigger,
	createRecipeComposioTrigger,
} from "./recipe-composio-triggers";

describe("recipe Composio triggers api", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("creates an event trigger for an installed recipe", async () => {
		const createdTrigger = {
			id: "trigger-1",
			installationId: "installation-1",
			projectId: "project-1",
			providerId: "github",
			triggerSlug: "GITHUB_COMMIT_EVENT",
			externalTriggerId: "external-1",
			connectedAccountId: "account-1",
			configuration: { branch: "main" },
			status: "active",
			lastError: null,
			createdAt: "2026-08-13T10:00:00.000Z",
			updatedAt: null,
		};
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json(createdTrigger),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			createRecipeComposioTrigger("installation-1", {
				providerId: "github",
				triggerSlug: "GITHUB_COMMIT_EVENT",
				connectedAccountId: "account-1",
				configuration: { branch: "main" },
			}),
		).resolves.toEqual(createdTrigger);

		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(String(url)).toContain("/apps/recipes/installations/installation-1/composio-triggers");
		expect(init).toMatchObject({ method: "POST" });
		expect(JSON.parse(String(init?.body))).toEqual({
			providerId: "github",
			triggerSlug: "GITHUB_COMMIT_EVENT",
			connectedAccountId: "account-1",
			configuration: { branch: "main" },
		});
	});

	it("lists, pauses, and removes recipe event triggers through their scoped endpoints", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					triggerTypes: [
						{
							slug: "GITHUB_COMMIT_EVENT",
							name: "New commit",
							description: "Runs for a new commit.",
							kind: "webhook",
							configuration: {},
						},
					],
				}),
			)
			.mockResolvedValueOnce(Response.json({ triggers: [] }))
			.mockResolvedValueOnce(Response.json({ id: "trigger-1", status: "paused" }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await listRecipeComposioTriggerTypes("installation/1", "github");
		await listRecipeComposioTriggers("installation/1");
		await updateRecipeComposioTrigger("trigger/1", "paused");
		await deleteRecipeComposioTrigger("trigger/1");

		expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
			"/installations/installation%2F1/composio-trigger-types?providerId=github",
		);
		expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
			"/installations/installation%2F1/composio-triggers",
		);
		expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: "PUT" });
		expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({ status: "paused" });
		expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/composio-triggers/trigger%2F1");
		expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({ method: "DELETE" });
	});
});
