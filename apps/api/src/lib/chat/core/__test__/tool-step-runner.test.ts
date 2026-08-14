import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getAIResponse: vi.fn(),
	handleToolCalls: vi.fn(),
}));

vi.mock("~/lib/chat/responses", () => ({
	getAIResponse: mocks.getAIResponse,
}));

vi.mock("~/lib/chat/tools", () => ({
	handleToolCalls: mocks.handleToolCalls,
}));

import { runNonStreamingToolSteps } from "../tool-step-runner";

const artifactToolResponse = {
	response: "",
	tool_calls: [
		{
			id: "call-artifact",
			function: { name: "artifact", arguments: "{}" },
		},
	],
};

const recoverableUnknownToolResult = {
	role: "tool",
	name: "artifact",
	content: "Artifacts are response markup, not tools.",
	status: "error",
	tool_call_id: "call-artifact",
	data: { errorCode: "UNKNOWN_TOOL", recoverable: true },
};

function createParams() {
	return {
		response: artifactToolResponse,
		requestParams: { messages: [], current_step: 1 } as any,
		completionId: "completion-123",
		conversationManager: {
			add: vi.fn(),
		} as any,
		toolRequestContext: { env: { AI: {} } } as any,
		maxSteps: undefined,
		buildAssistantMessage: (response: typeof artifactToolResponse) => ({
			role: "assistant" as const,
			content: response.response,
			tool_calls: response.tool_calls,
		}),
	};
}

describe("runNonStreamingToolSteps", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("gives an unknown artifact tool call one corrective model turn", async () => {
		mocks.handleToolCalls.mockResolvedValueOnce([recoverableUnknownToolResult]);
		mocks.getAIResponse.mockResolvedValueOnce({
			response:
				'<artifact identifier="demo" type="text/html" display="inline"><h1>Demo</h1></artifact>',
			tool_calls: [],
		});

		const result = await runNonStreamingToolSteps(createParams());

		expect(mocks.handleToolCalls).toHaveBeenCalledWith(
			"completion-123",
			artifactToolResponse,
			expect.any(Object),
			expect.any(Object),
			{ recoverUnknownToolCalls: true },
		);
		expect(mocks.getAIResponse).toHaveBeenCalledTimes(1);
		expect(result.response.response).toContain('<artifact identifier="demo"');
	});

	it("does not grant a second recovery turn for a repeated unknown tool call", async () => {
		mocks.handleToolCalls
			.mockResolvedValueOnce([recoverableUnknownToolResult])
			.mockResolvedValueOnce([
				{
					...recoverableUnknownToolResult,
					data: { errorCode: "UNKNOWN_TOOL" },
				},
			]);
		mocks.getAIResponse.mockResolvedValueOnce(artifactToolResponse);

		const result = await runNonStreamingToolSteps(createParams());

		expect(mocks.handleToolCalls).toHaveBeenNthCalledWith(
			2,
			"completion-123",
			artifactToolResponse,
			expect.any(Object),
			expect.any(Object),
			{ recoverUnknownToolCalls: false },
		);
		expect(mocks.getAIResponse).toHaveBeenCalledTimes(1);
		expect(result.response.tool_calls).toHaveLength(1);
	});

	it("continues a successful capability discovery with the default step budget", async () => {
		const discoveryResponse = {
			response: "",
			tool_calls: [
				{
					id: "call-discovery",
					function: { name: "discover_capabilities", arguments: "{}" },
				},
			],
		};
		mocks.handleToolCalls.mockResolvedValueOnce([
			{
				role: "tool",
				name: "discover_capabilities",
				content: "A connected capability is ready.",
				status: "success",
				tool_call_id: "call-discovery",
			},
		]);
		mocks.getAIResponse.mockResolvedValueOnce({
			response: "Continuing with the connected capability.",
			tool_calls: [],
		});

		const result = await runNonStreamingToolSteps({
			...createParams(),
			response: discoveryResponse,
			buildAssistantMessage: (response: typeof discoveryResponse) => ({
				role: "assistant" as const,
				content: response.response,
				tool_calls: response.tool_calls,
			}),
		});

		expect(mocks.getAIResponse).toHaveBeenCalledOnce();
		expect(result.response.response).toBe("Continuing with the connected capability.");
	});

	it("does not continue capability discovery while setup is pending", async () => {
		const discoveryResponse = {
			response: "",
			tool_calls: [
				{
					id: "call-discovery",
					function: { name: "discover_capabilities", arguments: "{}" },
				},
			],
		};
		mocks.handleToolCalls.mockResolvedValueOnce([
			{
				role: "tool",
				name: "discover_capabilities",
				content: "Setup is required.",
				status: "pending",
				tool_call_id: "call-discovery",
			},
		]);

		await runNonStreamingToolSteps({
			...createParams(),
			response: discoveryResponse,
			buildAssistantMessage: (response: typeof discoveryResponse) => ({
				role: "assistant" as const,
				content: response.response,
				tool_calls: response.tool_calls,
			}),
		});

		expect(mocks.getAIResponse).not.toHaveBeenCalled();
	});
});
