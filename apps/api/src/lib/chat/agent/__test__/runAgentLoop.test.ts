import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentLoopExecutionParams } from "../runAgentLoop";

const mocks = vi.hoisted(() => ({
	getAIResponse: vi.fn(),
	handleToolCalls: vi.fn(),
	generateId: vi.fn(),
}));

vi.mock("~/lib/chat/responses", () => ({
	getAIResponse: mocks.getAIResponse,
}));

vi.mock("~/lib/chat/tools", () => ({
	handleToolCalls: mocks.handleToolCalls,
}));

vi.mock("~/utils/id", () => ({
	generateId: mocks.generateId,
}));

import { runAgentLoop } from "../runAgentLoop";

function createParams(overrides: Partial<AgentLoopExecutionParams> = {}): AgentLoopExecutionParams {
	return {
		completionId: "agent-conversation-1",
		conversationManager: {} as AgentLoopExecutionParams["conversationManager"],
		toolRequestContext: {
			env: { AI: { aiGatewayLogId: "log-1" } },
			request: {
				model: "deepseek-chat",
				mode: "agent",
				enabled_tools: ["get_weather"],
				approved_tools: ["get_weather"],
			},
			mode: "agent",
		} as unknown as AgentLoopExecutionParams["toolRequestContext"],
		requestParams: {
			env: { AI: { aiGatewayLogId: "log-1" } },
			model: "deepseek-chat",
			provider: "deepseek",
			messages: [
				{
					role: "user",
					content: "Check morning weather for London W5 1EW.",
				},
			],
			mode: "agent",
			enabled_tools: ["get_weather"],
			approved_tools: ["get_weather"],
			tool_choice: "auto",
			options: {
				agent: {
					minToolCalls: 1,
				},
			},
		} as unknown as AgentLoopExecutionParams["requestParams"],
		maxSteps: 4,
		...overrides,
	};
}

describe("runAgentLoop", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.generateId.mockReturnValue("generated-tool-call-id");
	});

	it("does not accept a final response before generic minimum tool requirements are met", async () => {
		mocks.getAIResponse
			.mockResolvedValueOnce({
				response: "I will check the weather now.",
			})
			.mockResolvedValueOnce({
				response: "",
				tool_calls: [
					{
						id: "call-weather",
						type: "function",
						function: {
							name: "get_weather",
							arguments: JSON.stringify({
								latitude: 51.513,
								longitude: -0.305,
							}),
						},
					},
				],
			})
			.mockResolvedValueOnce({
				response: "No bad weather thresholds are triggered for London W5 1EW this morning.",
			});
		mocks.handleToolCalls.mockResolvedValue([
			{
				role: "tool",
				name: "get_weather",
				content: "Forecast: light cloud, 18C, light winds.",
				status: "success",
				tool_call_id: "call-weather",
			},
		]);

		const result = await runAgentLoop(createParams());

		expect(result.response.response).toBe(
			"No bad weather thresholds are triggered for London W5 1EW this morning.",
		);
		expect(mocks.getAIResponse).toHaveBeenCalledTimes(3);
		expect(mocks.getAIResponse).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				tool_choice: "required",
			}),
		);
		expect(mocks.getAIResponse).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				tool_choice: "required",
			}),
		);
		expect(mocks.getAIResponse).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				tool_choice: "auto",
			}),
		);
		expect(mocks.handleToolCalls).toHaveBeenCalledWith(
			"agent-conversation-1",
			expect.objectContaining({
				tool_calls: [
					expect.objectContaining({
						id: "call-weather",
						function: expect.objectContaining({ name: "get_weather" }),
					}),
				],
			}),
			expect.anything(),
			expect.anything(),
		);
	});

	it("extends the step budget after tool progress so the model can finish", async () => {
		mocks.getAIResponse
			.mockResolvedValueOnce({
				response: "",
				tool_calls: [
					{
						id: "call-weather",
						type: "function",
						function: {
							name: "get_weather",
							arguments: JSON.stringify({
								latitude: 51.513,
								longitude: -0.305,
							}),
						},
					},
				],
			})
			.mockResolvedValueOnce({
				response: "",
				tool_calls: [
					{
						id: "call-weather-follow-up",
						type: "function",
						function: {
							name: "get_weather",
							arguments: JSON.stringify({
								latitude: 51.513,
								longitude: -0.305,
								hour: "09:00",
							}),
						},
					},
				],
			})
			.mockResolvedValueOnce({
				response: "No bad weather thresholds are triggered for London W5 1EW this morning.",
			});
		mocks.handleToolCalls
			.mockResolvedValueOnce([
				{
					role: "tool",
					name: "get_weather",
					content: "Forecast: rain probability available.",
					status: "success",
					tool_call_id: "call-weather",
				},
			])
			.mockResolvedValueOnce([
				{
					role: "tool",
					name: "get_weather",
					content: "09:00 forecast: light cloud, 18C, light winds.",
					status: "success",
					tool_call_id: "call-weather-follow-up",
				},
			]);

		const result = await runAgentLoop(
			createParams({
				maxSteps: 2,
			}),
		);

		expect(result.response.response).toBe(
			"No bad weather thresholds are triggered for London W5 1EW this morning.",
		);
		expect(mocks.getAIResponse).toHaveBeenCalledTimes(3);
		expect(mocks.handleToolCalls).toHaveBeenCalledTimes(2);
	});

	it("does not count failed tool results toward minimum tool requirements", async () => {
		mocks.getAIResponse
			.mockResolvedValueOnce({
				response: "",
				tool_calls: [
					{
						id: "call-weather-failed",
						type: "function",
						function: {
							name: "get_weather",
							arguments: JSON.stringify({
								latitude: 51.513,
								longitude: -0.305,
							}),
						},
					},
				],
			})
			.mockResolvedValueOnce({
				response: "I could not check the weather because the tool failed.",
			})
			.mockResolvedValueOnce({
				response: "",
				tool_calls: [
					{
						id: "call-weather-retry",
						type: "function",
						function: {
							name: "get_weather",
							arguments: JSON.stringify({
								latitude: 51.513,
								longitude: -0.305,
							}),
						},
					},
				],
			})
			.mockResolvedValueOnce({
				response: "No bad weather thresholds are triggered for London W5 1EW this morning.",
			});
		mocks.handleToolCalls
			.mockResolvedValueOnce([
				{
					role: "tool",
					name: "get_weather",
					content: "Tool failed: upstream service rejected the input.",
					status: "error",
					tool_call_id: "call-weather-failed",
				},
			])
			.mockResolvedValueOnce([
				{
					role: "tool",
					name: "get_weather",
					content: "Forecast: light cloud, 18C, light winds.",
					status: "success",
					tool_call_id: "call-weather-retry",
				},
			]);

		const result = await runAgentLoop(createParams());

		expect(result.response.response).toBe(
			"No bad weather thresholds are triggered for London W5 1EW this morning.",
		);
		expect(mocks.getAIResponse).toHaveBeenCalledTimes(4);
		expect(mocks.handleToolCalls).toHaveBeenCalledTimes(2);
		expect(mocks.getAIResponse).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				tool_choice: "required",
			}),
		);
		expect(mocks.getAIResponse).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({
				tool_choice: "auto",
			}),
		);
	});

	it("aborts empty provider responses instead of retrying until step exhaustion", async () => {
		mocks.getAIResponse.mockResolvedValue({
			response: "",
			tool_calls: [],
		});

		await expect(runAgentLoop(createParams())).rejects.toThrow(
			"No response generated by the model",
		);

		expect(mocks.getAIResponse).toHaveBeenCalledTimes(1);
	});
});
