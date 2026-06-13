import { afterEach, describe, expect, it, vi } from "vitest";

import { executeAsanaOperation } from "../asana";

describe("executeAsanaOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists Asana projects with bounded query parameters", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: [] })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeAsanaOperation("token", "list_projects", {
				workspaceId: "workspace-1",
				limit: 500,
			}),
		).resolves.toEqual({ data: [] });

		const [url, init] = fetchMock.mock.calls[0] ?? ["", undefined];
		expect(String(url)).toBe(
			"https://app.asana.com/api/1.0/projects?workspace=workspace-1&limit=100&opt_fields=gid%2Cname%2Cpermalink_url%2Cworkspace.name",
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

	it("lists Asana project tasks with compact fields", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: [] })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeAsanaOperation("token", "list_tasks", {
				projectId: "project-1",
				limit: 10,
			}),
		).resolves.toEqual({ data: [] });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe(
			"https://app.asana.com/api/1.0/projects/project-1/tasks?limit=10&opt_fields=gid%2Cname%2Ccompleted%2Cdue_on%2Cdue_at%2Cpermalink_url%2Cprojects.name%2Cassignee.name",
		);
	});

	it("rejects broad Asana task lists without a supported filter", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: [] })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeAsanaOperation("token", "list_tasks", {
				workspaceId: "workspace-1",
			}),
		).rejects.toThrow("projectId or workspaceId and assignee are required");

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("creates Asana tasks with supported task fields only", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ data: { gid: "task-1" } }), { status: 201 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeAsanaOperation("token", "create_task", {
				name: "Follow up",
				notes: "Ask for an update",
				projectIds: ["project-1", "project-2"],
				assignee: "me",
				dueOn: "2026-06-09",
			}),
		).resolves.toEqual({ data: { gid: "task-1" } });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://app.asana.com/api/1.0/tasks?opt_fields=gid,name,permalink_url,completed,due_on,due_at,projects.name",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					data: {
						name: "Follow up",
						notes: "Ask for an update",
						projects: ["project-1", "project-2"],
						assignee: "me",
						due_on: "2026-06-09",
					},
				}),
			}),
		);
	});

	it("rejects Asana task creation without a workspace or project", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ data: { gid: "task-1" } }), { status: 201 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeAsanaOperation("token", "create_task", {
				name: "Follow up",
			}),
		).rejects.toThrow("workspaceId or projectIds is required");

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
