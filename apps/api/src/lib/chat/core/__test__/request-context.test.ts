import { describe, expect, it } from "vitest";

import { buildToolPermissionsMap, buildToolRequestContext } from "../request-context";

describe("chat request context helpers", () => {
	it("builds tool permission maps from direct and provider-shaped tools", () => {
		expect(
			buildToolPermissionsMap([
				{ name: "sandbox", permissions: ["sandbox:write"] },
				{ function: { name: "search" }, permissions: ["network:read"] },
				{ name: "ignored", permissions: [] },
			]),
		).toEqual({
			sandbox: ["sandbox:write"],
			search: ["network:read"],
		});
	});

	it("preserves chat, delegation, and tool context for tool execution", () => {
		const context = buildToolRequestContext({
			chatOptions: {
				env: { AI: {} },
				completion_id: "completion-1",
				app_url: "https://app.test",
				user: { id: "user-1" },
				context: { requestId: "request-1" },
				messages: [{ role: "user", content: "hello" }],
				approved_tools: ["sandbox"],
				tools: [{ name: "sandbox", permissions: ["sandbox:write"] }],
				options: { sandbox: { enabled: true } },
				current_agent_id: "agent-1",
				delegation_stack: ["agent-0"],
				max_delegation_depth: 2,
			} as any,
			input: "hello with context",
			mode: "build",
			model: "model-1",
			provider: "provider-1",
		});

		expect(context).toMatchObject({
			mode: "build",
			app_url: "https://app.test",
			user: { id: "user-1" },
			context: { requestId: "request-1" },
			request: {
				completion_id: "completion-1",
				input: "hello with context",
				model: "model-1",
				provider: "provider-1",
				mode: "build",
				approved_tools: ["sandbox"],
				tool_permissions_map: {
					sandbox: ["sandbox:write"],
				},
				options: { sandbox: { enabled: true } },
				current_agent_id: "agent-1",
				delegation_stack: ["agent-0"],
				max_delegation_depth: 2,
			},
		});
		expect(context.request.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
