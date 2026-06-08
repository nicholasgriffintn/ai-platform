import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeDevinOperation } from "../devin";

describe("executeDevinOperation", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
		);
	});

	it("lists organization sessions with bounded pagination and filters", async () => {
		await expect(
			executeDevinOperation("token", "list_sessions", {
				organizationId: "org_123",
				first: 500,
				after: "cursor_123",
				tags: ["polychat", "recipe"],
				repo_names: ["owner/repo"],
				isArchived: false,
			}),
		).resolves.toEqual({ ok: true });

		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(String(url)).toBe(
			"https://api.devin.ai/v3/organizations/org_123/sessions?after=cursor_123&first=100&tags=polychat&tags=recipe&repo_names=owner%2Frepo&is_archived=false",
		);
		expect(init).toMatchObject({
			headers: expect.objectContaining({
				Authorization: "Bearer token",
			}),
		});
	});

	it("gets a specific session", async () => {
		await executeDevinOperation("token", "get_session", {
			orgId: "org_123",
			devinId: "devin_123",
		});

		const [url] = vi.mocked(fetch).mock.calls[0];
		expect(String(url)).toBe("https://api.devin.ai/v3/organizations/org_123/sessions/devin_123");
	});

	it("creates sessions with documented v3 fields", async () => {
		await executeDevinOperation("token", "create_session", {
			organizationId: "org_123",
			prompt: "Review this repository and produce an implementation plan.",
			title: "Repository review",
			tags: ["polychat"],
			repos: ["owner/repo"],
			playbookId: "playbook_123",
			maxAcuLimit: 3.9,
			devinMode: "fast",
		});

		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(String(url)).toBe("https://api.devin.ai/v3/organizations/org_123/sessions");
		expect(init).toMatchObject({
			method: "POST",
			headers: expect.objectContaining({
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			}),
		});
		expect(JSON.parse(String(init?.body))).toEqual({
			prompt: "Review this repository and produce an implementation plan.",
			title: "Repository review",
			tags: ["polychat"],
			repos: ["owner/repo"],
			playbook_id: "playbook_123",
			max_acu_limit: 3,
			devin_mode: "fast",
		});
	});

	it("lists and sends session messages", async () => {
		await executeDevinOperation("token", "list_messages", {
			organizationId: "org_123",
			sessionId: "devin_123",
			first: 25,
		});
		await executeDevinOperation("token", "send_message", {
			organizationId: "org_123",
			sessionId: "devin_123",
			message: "Please continue with the implementation.",
		});

		expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
			"https://api.devin.ai/v3/organizations/org_123/sessions/devin_123/messages?first=25",
		);
		expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
			"https://api.devin.ai/v3/organizations/org_123/sessions/devin_123/messages",
		);
		expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({
			message: "Please continue with the implementation.",
		});
	});

	it("requires organization, session, prompt, and message fields", async () => {
		await expect(executeDevinOperation("token", "list_sessions", {})).rejects.toThrow(
			"organizationId is required",
		);
		await expect(
			executeDevinOperation("token", "get_session", { organizationId: "org_123" }),
		).rejects.toThrow("sessionId is required");
		await expect(
			executeDevinOperation("token", "create_session", { organizationId: "org_123" }),
		).rejects.toThrow("prompt is required");
		await expect(
			executeDevinOperation("token", "send_message", {
				organizationId: "org_123",
				sessionId: "devin_123",
			}),
		).rejects.toThrow("message is required");
	});
});
