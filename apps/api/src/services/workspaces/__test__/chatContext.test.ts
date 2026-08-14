import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ErrorType } from "~/utils/errors";
import { applyProjectCodingEnvironment, resolveProjectChatContext } from "../chatContext";
import {
	resolveAllowedProjectConnectorOperations,
	resolveProjectRecipeConnectorScope,
} from "../projectRecipeConnectorScope";

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
		requireUser: vi.fn().mockReturnValue({
			id: 7,
			email: "member@example.com",
			plan_id: "pro",
		}),
		repositories,
	} as unknown as ServiceContext;

	return { context, repositories };
}

describe("project chat context", () => {
	it("keeps the project repository fixed while allowing a conversation task type", () => {
		const options = applyProjectCodingEnvironment(
			{
				options: {
					sandbox: {
						enabled: true,
						installationId: 999,
						repo: "other/repository",
						model: "untrusted-model",
						taskType: "bug-fix",
					},
				},
			},
			{
				projectId: "project-1",
				instructions: "",
				enabledTools: [],
				sandboxOptions: {
					enabled: true,
					installationId: 123,
					repo: "owner/repository",
					taskType: "feature-implementation",
					promptStrategy: "auto",
					shouldCommit: true,
					timeoutSeconds: 900,
				},
			},
		);

		expect(options.options?.sandbox).toMatchObject({
			enabled: true,
			installationId: 123,
			repo: "owner/repository",
			taskType: "bug-fix",
		});
		expect(options.options?.sandbox?.model).toBeUndefined();
	});

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
			enabledTools: [
				"web_search",
				"code_execution",
				"search_grounding",
				"image_generation",
				"tool_search",
				"hosted_shell",
				"web_fetch",
			],
			toolOptions: undefined,
		});
	});

	it("enables configuration-backed tools only from validated project settings", async () => {
		const { context, repositories } = createContext();
		repositories.workspaces.listProjectCapabilities.mockResolvedValue([
			{
				kind: "tool",
				capability_id: "file_search",
				configuration: JSON.stringify({ vectorStoreIds: ["vs_project"] }),
			},
			{
				kind: "tool",
				capability_id: "mcp",
				configuration: {
					servers: [{ label: "docs", url: "https://mcp.example.com" }],
				},
			},
		]);

		const result = await resolveProjectChatContext(context, {
			metadata: { project_id: "project-1" },
		});

		expect(result?.enabledTools).toContain("file_search");
		expect(result?.enabledTools).toContain("mcp");
		expect(result?.toolOptions).toEqual({
			file_search: { vector_store_ids: ["vs_project"] },
			mcp_servers: [
				{
					require_approval: "always",
					server_label: "docs",
					server_url: "https://mcp.example.com/",
				},
			],
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

		expect(result?.enabledTools).toEqual([
			"code_execution",
			"search_grounding",
			"image_generation",
			"tool_search",
			"hosted_shell",
			"web_fetch",
			"get_weather",
		]);
	});

	it("limits direct connector execution to providers and operations from project recipes", () => {
		const scope = resolveProjectRecipeConnectorScope([
			{ kind: "recipe", capability_id: "gmail" },
			{ kind: "recipe", capability_id: "unknown-recipe" },
			{ kind: "tool", capability_id: "web_search" },
		]);

		expect(scope.providers).toEqual(["gmail"]);
		expect(scope.operationsByProvider.gmail).toEqual([
			"GMAIL_FETCH_EMAILS",
			"GMAIL_CREATE_EMAIL_DRAFT",
		]);
	});

	it("fails closed when a project recipe has no explicit connector operation allowlist", () => {
		expect(
			resolveAllowedProjectConnectorOperations({
				projectScope: { providers: ["gmail"], operationsByProvider: {} },
				provider: "gmail",
				recipeOperations: undefined,
			}),
		).toEqual([]);
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
