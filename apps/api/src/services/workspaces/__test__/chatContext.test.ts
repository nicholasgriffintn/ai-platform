import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ErrorType } from "~/utils/errors";
import { resolveProjectChatContext } from "../chatContext";

function createContext({
	conversation = null,
	membership = { role: "member" },
}: {
	conversation?: Record<string, unknown> | null;
	membership?: { role: "owner" | "admin" | "member" } | null;
} = {}) {
	const repositories = {
		conversations: {
			getConversation: vi.fn().mockResolvedValue(conversation),
		},
		workspaces: {
			getProject: vi.fn().mockResolvedValue({
				id: "project-1",
				workspace_id: "workspace-1",
				instructions: "Use the approved launch brief.",
			}),
			getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
			getMembership: vi.fn().mockResolvedValue(membership),
			listProjectCapabilities: vi.fn().mockResolvedValue([
				{ kind: "tool", capability_id: "web_search" },
				{ kind: "recipe", capability_id: "launch-brief" },
			]),
		},
	};
	const context = {
		requireUser: vi.fn().mockReturnValue({ id: 7, email: "member@example.com" }),
		repositories,
	} as unknown as ServiceContext;

	return { context, repositories };
}

describe("project chat context", () => {
	it("resolves instructions and tools from the authorised project", async () => {
		const { context } = createContext();

		await expect(
			resolveProjectChatContext(context, {
				completion_id: "new-conversation",
				metadata: { project_id: "project-1" },
			}),
		).resolves.toEqual({
			projectId: "project-1",
			instructions: "Use the approved launch brief.",
			enabledTools: ["web_search"],
		});
	});

	it("uses the stored project for an existing project conversation", async () => {
		const { context } = createContext({ conversation: { project_id: "project-1" } });

		const result = await resolveProjectChatContext(context, {
			completion_id: "conversation-1",
		});

		expect(result?.projectId).toBe("project-1");
	});

	it("allows only catalogue tools for a recipe enabled in the project", async () => {
		const { context, repositories } = createContext();
		repositories.workspaces.listProjectCapabilities.mockResolvedValue([
			{ kind: "recipe", capability_id: "daily-weather" },
		]);

		const result = await resolveProjectChatContext(context, {
			completion_id: "new-conversation",
			metadata: { project_id: "project-1" },
			enabled_tools: ["get_weather", "untrusted_tool"],
			options: { recipe: { id: "daily-weather" } },
		});

		expect(result?.enabledTools).toEqual(["get_weather"]);
	});

	it("rejects moving an existing personal conversation into a project", async () => {
		const { context } = createContext({ conversation: { project_id: null } });

		await expect(
			resolveProjectChatContext(context, {
				completion_id: "conversation-1",
				metadata: { project_id: "project-1" },
			}),
		).rejects.toMatchObject({ type: ErrorType.CONFLICT_ERROR, statusCode: 409 });
	});

	it("does not disclose a project to users outside its workspace", async () => {
		const { context } = createContext({ membership: null });

		await expect(
			resolveProjectChatContext(context, {
				completion_id: "new-conversation",
				metadata: { project_id: "project-1" },
			}),
		).rejects.toMatchObject({ type: ErrorType.NOT_FOUND, statusCode: 404 });
	});
});
