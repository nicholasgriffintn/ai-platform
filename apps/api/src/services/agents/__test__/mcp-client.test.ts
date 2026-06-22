import { describe, expect, it } from "vitest";

import {
	createMCPToolName,
	parseMCPServerConfigs,
	parseMCPToolName,
	resolveMCPAIToolDefinition,
} from "../mcp-client";

describe("agent MCP client contract", () => {
	it("parses persisted server configuration once for agent MCP callers", () => {
		const configs = parseMCPServerConfigs(
			JSON.stringify([
				{ url: "https://example.com/mcp", name: "Example" },
				{ name: "missing-url" },
			]),
		);

		expect(configs).toEqual([{ url: "https://example.com/mcp", name: "Example" }]);
	});

	it("uses a stable wrapper name that can be parsed back to the agent prefix and MCP tool", () => {
		const wrappedName = createMCPToolName(
			"12345678-90ab-cdef-1234-567890abcdef",
			"fetch_user_profile",
		);

		expect(wrappedName).toBe("mcp_12345678_fetch_user_profile");
		expect(parseMCPToolName(wrappedName)).toEqual({
			shortAgentId: "12345678",
			toolName: "fetch_user_profile",
		});
		expect(parseMCPToolName("not_mcp_fetch_user_profile")).toBeNull();
	});

	it("keeps only AI tools with callable parameter schemas", () => {
		const tool = resolveMCPAIToolDefinition("agent-abcdef", "search_docs", {
			description: "Search docs",
			parameters: {
				jsonSchema: {
					type: "object",
					properties: {
						query: { type: "string" },
					},
				},
			},
		});

		expect(tool).toEqual({
			name: "mcp_agent-ab_search_docs",
			description: "Search docs",
			parameters: {
				jsonSchema: {
					type: "object",
					properties: {
						query: { type: "string" },
					},
				},
			},
		});
		expect(resolveMCPAIToolDefinition("agent-abcdef", "broken", { parameters: {} })).toBeNull();
	});
});
