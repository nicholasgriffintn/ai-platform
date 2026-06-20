import { afterEach, describe, expect, it, vi } from "vitest";

import { executeTodoistOperation } from "../todoist";

describe("executeTodoistOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists Todoist tasks with bounded query parameters", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ results: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeTodoistOperation("token", "list_tasks", {
				projectId: "project-1",
				label: "work",
				limit: 500,
			}),
		).resolves.toEqual({ results: [] });

		const [url, init] = fetchMock.mock.calls[0] ?? ["", undefined];
		expect(String(url)).toBe(
			"https://api.todoist.com/api/v1/tasks?project_id=project-1&label=work&limit=100",
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

	it("creates Todoist tasks with supported task fields only", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "task-1" })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeTodoistOperation("token", "create_task", {
				content: "Follow up",
				description: "Ask for an update",
				projectId: "project-1",
				labels: ["work", "urgent"],
				priority: 4,
				dueString: "tomorrow",
			}),
		).resolves.toEqual({ id: "task-1" });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.todoist.com/api/v1/tasks",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					content: "Follow up",
					description: "Ask for an update",
					project_id: "project-1",
					labels: ["work", "urgent"],
					priority: 4,
					due_string: "tomorrow",
				}),
			}),
		);
	});

	it("rejects invalid Todoist priorities before calling Todoist", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "task-1" })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeTodoistOperation("token", "create_task", {
				content: "Follow up",
				priority: 5,
			}),
		).rejects.toThrow("priority must be between 1 and 4");

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("completes Todoist tasks when the API returns a null JSON body", async () => {
		const fetchMock = vi.fn(async () => new Response("null", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeTodoistOperation("token", "complete_task", { taskId: "task-1" }),
		).resolves.toEqual({ completed: true, taskId: "task-1" });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.todoist.com/api/v1/tasks/task-1/close",
			expect.objectContaining({
				method: "POST",
			}),
		);
	});
});
