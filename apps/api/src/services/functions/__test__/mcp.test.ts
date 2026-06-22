import { describe, expect, it, vi } from "vitest";

import { handleMCPTool, registerMCPClient } from "../mcp";

describe("MCP function execution", () => {
	it("executes wrapped MCP tool names without stripping underscore prefixes", async () => {
		const callTool = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "done" }] });
		const client = {
			mcpConnections: {
				server1: {
					connectionState: "ready",
				},
			},
			getAITools: vi.fn().mockResolvedValue({
				fetch_user_profile: {
					parameters: {
						properties: {
							userId: { type: "string" },
						},
					},
				},
			}),
			callTool,
		};

		registerMCPClient("12345678-90ab-cdef-1234-567890abcdef", client);

		await handleMCPTool(
			"completion-1",
			{ userId: "user-1" },
			{
				request: {
					functionName: "mcp_12345678_fetch_user_profile",
				},
			},
		);

		expect(callTool).toHaveBeenCalledWith(
			{
				name: "fetch_user_profile",
				serverId: "server1",
				arguments: { userId: "user-1" },
			},
			undefined,
			expect.objectContaining({
				signal: expect.any(AbortSignal),
			}),
		);
	});
});
