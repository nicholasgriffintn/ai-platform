import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveModelConfig, mockSelectFimModel, mockGetProvider, mockGetResponse } = vi.hoisted(
	() => {
		const mockGetResponse = vi.fn();

		return {
			mockResolveModelConfig: vi.fn(),
			mockSelectFimModel: vi.fn(),
			mockGetProvider: vi.fn(() => ({
				getResponse: mockGetResponse,
			})),
			mockGetResponse,
		};
	},
);

vi.mock("~/lib/providers/models", () => ({
	resolveModelConfig: mockResolveModelConfig,
}));

vi.mock("~/lib/modelRouter", () => ({
	ModelRouter: {
		selectFimModel: mockSelectFimModel,
	},
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: mockGetProvider,
}));

import { handleCreateFimCompletions } from "../createFimCompletions";
import { AssistantError, ErrorType } from "~/utils/errors";

const env = {} as any;
const user = { id: 7 } as any;

describe("handleCreateFimCompletions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws when resolved model configuration is missing", async () => {
		mockSelectFimModel.mockReturnValue("codestral-latest");
		mockResolveModelConfig.mockRejectedValueOnce(
			new AssistantError("Model codestral-latest not found", ErrorType.PARAMS_ERROR),
		);

		await expect(
			handleCreateFimCompletions({
				env,
				prompt: "def foo():",
			}),
		).rejects.toMatchObject({
			message: "Model codestral-latest not found",
			type: ErrorType.PARAMS_ERROR,
		});

		expect(mockGetProvider).not.toHaveBeenCalled();
	});

	it("throws when model does not support FIM", async () => {
		mockSelectFimModel.mockReturnValue("codestral-latest");
		mockResolveModelConfig.mockResolvedValueOnce({
			matchingModel: "codestral-latest",
			provider: "mistral",
			supportsFim: false,
		});

		await expect(
			handleCreateFimCompletions({
				env,
				prompt: "class Foo:",
			}),
		).rejects.toBeInstanceOf(AssistantError);

		expect(mockGetProvider).not.toHaveBeenCalled();
	});

	it("calls provider with fim parameters when model provided", async () => {
		mockResolveModelConfig.mockResolvedValueOnce({
			matchingModel: "codestral-latest",
			provider: "mistral",
			supportsFim: true,
		});
		mockGetResponse.mockResolvedValueOnce({ text: "response" });

		const result = await handleCreateFimCompletions({
			env,
			user,
			model: "codestral-latest",
			provider: "mistral",
			prompt: "print(",
			suffix: ")",
			max_tokens: 120,
			min_tokens: 20,
			temperature: 0.4,
			top_p: 0.9,
			stop: ["\n"],
		});

		expect(mockSelectFimModel).not.toHaveBeenCalled();
		expect(mockGetProvider).toHaveBeenCalledWith("mistral", { env, user });
		expect(mockGetResponse).toHaveBeenCalledWith({
			env,
			context: expect.objectContaining({
				user,
			}),
			model: "codestral-latest",
			provider: "mistral",
			prompt: "print(",
			suffix: ")",
			fim_mode: true,
			max_tokens: 120,
			min_tokens: 20,
			temperature: 0.4,
			top_p: 0.9,
			stream: undefined,
			stop: ["\n"],
			message: "print(",
		});
		expect(result).toEqual({ text: "response" });
	});

	it("selects model automatically when not provided", async () => {
		mockSelectFimModel.mockReturnValue("codestral-latest");
		mockResolveModelConfig.mockResolvedValueOnce({
			matchingModel: "codestral-latest",
			provider: "mistral",
			supportsFim: true,
		});
		mockGetResponse.mockResolvedValueOnce({ choices: [] });

		const result = await handleCreateFimCompletions({
			env,
			prompt: "function main() {",
		});

		expect(mockSelectFimModel).toHaveBeenCalled();
		expect(mockGetProvider).toHaveBeenCalledWith("mistral", {
			env,
			user: undefined,
		});
		expect(mockGetResponse).toHaveBeenCalledWith({
			env,
			context: expect.objectContaining({
				user: null,
			}),
			model: "codestral-latest",
			provider: "mistral",
			prompt: "function main() {",
			suffix: undefined,
			fim_mode: true,
			max_tokens: undefined,
			min_tokens: undefined,
			temperature: undefined,
			top_p: undefined,
			stream: undefined,
			stop: undefined,
			message: "function main() {",
		});
		expect(result).toEqual({ choices: [] });
	});
});
