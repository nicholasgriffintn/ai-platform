import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreChatOptions } from "~/types";
import { processChatRequest } from "../index";

const mockOrchestrator = {
	process: vi.fn(),
};

vi.mock("../ChatOrchestrator", () => ({
	ChatOrchestrator: vi.fn(() => mockOrchestrator),
}));

describe("processChatRequest", () => {
	let mockOptions: CoreChatOptions;

	beforeEach(() => {
		vi.clearAllMocks();

		mockOptions = {
			completion_id: "test-completion-id",
			model: "test-model",
			messages: [{ role: "user", content: "Hello" }],
			user: { id: "test-user" },
			env: { AI: { aiGatewayLogId: "test-log-id" } },
			app_url: "https://test.com",
		} as any;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should create orchestrator with env and process options", async () => {
		const mockResult = {
			response: { response: "Test response" },
			selectedModel: "test-model",
			completion_id: "test-completion-id",
		};

		mockOrchestrator.process.mockResolvedValue(mockResult);

		const result = await processChatRequest(mockOptions);

		expect(mockOrchestrator.process).toHaveBeenCalledWith(mockOptions);
		expect(result).toEqual(mockResult);
	});

	it("should handle orchestrator errors", async () => {
		const error = new Error("Orchestrator error");
		mockOrchestrator.process.mockRejectedValue(error);

		await expect(processChatRequest(mockOptions)).rejects.toThrow(error);
	});

	it("should handle streaming responses", async () => {
		const mockStream = new ReadableStream();
		const streamResult = {
			stream: mockStream,
			selectedModel: "test-model",
			completion_id: "test-completion-id",
		};

		mockOrchestrator.process.mockResolvedValue(streamResult);

		const result = await processChatRequest({
			...mockOptions,
			stream: true,
		});

		expect(result).toEqual(streamResult);
	});

	it("should handle validation errors", async () => {
		const validationResult = {
			selectedModel: "test-model",
			validation: "input",
			error: "Invalid input",
			violations: ["test-violation"],
		};

		mockOrchestrator.process.mockResolvedValue(validationResult);

		const result = await processChatRequest(mockOptions);

		expect(result).toEqual(validationResult);
	});

	it("should handle multi-model responses", async () => {
		const multiModelResult = {
			response: { response: "Test response" },
			selectedModel: "primary-model",
			selectedModels: ["model-1", "model-2"],
			completion_id: "test-completion-id",
		};

		mockOrchestrator.process.mockResolvedValue(multiModelResult);

		const result = await processChatRequest(mockOptions);

		expect(result).toEqual(multiModelResult);
	});

	it("should handle tool responses", async () => {
		const toolResult = {
			response: { response: "Test response", tool_calls: [] },
			toolResponses: [{ role: "tool", content: "tool result" }],
			selectedModel: "test-model",
			completion_id: "test-completion-id",
		};

		mockOrchestrator.process.mockResolvedValue(toolResult);

		const result = await processChatRequest(mockOptions);

		expect(result).toEqual(toolResult);
	});

	describe("parameter validation", () => {
		it("should throw error for missing required parameters", async () => {
			mockOrchestrator.process.mockRejectedValue(
				new Error("Missing required parameters"),
			);

			await expect(processChatRequest({} as any)).rejects.toThrow(
				"Missing required parameters",
			);
		});

		it("should handle different parameter combinations", async () => {
			const optionsWithTools = {
				...mockOptions,
				tools: [{ type: "function", function: { name: "test_tool" } }],
				tool_choice: "auto",
				enabled_tools: ["search"],
			};

			mockOrchestrator.process.mockResolvedValue({
				response: { response: "Test response" },
				selectedModel: "test-model",
				completion_id: "test-completion-id",
			});

			// @ts-ignore - optionsWithTools is not a CoreChatOptions
			await processChatRequest(optionsWithTools);

			expect(mockOrchestrator.process).toHaveBeenCalledWith(optionsWithTools);
		});

		it("should handle streaming parameters", async () => {
			const streamingOptions = {
				...mockOptions,
				stream: true,
				temperature: 0.7,
				max_tokens: 1000,
			};

			mockOrchestrator.process.mockResolvedValue({
				stream: new ReadableStream(),
				selectedModel: "test-model",
				completion_id: "test-completion-id",
			});

			await processChatRequest(streamingOptions);

			expect(mockOrchestrator.process).toHaveBeenCalledWith(streamingOptions);
		});
	});
});
