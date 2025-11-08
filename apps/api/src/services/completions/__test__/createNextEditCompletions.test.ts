import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockGetModelConfig,
	mockGetModelConfigByMatchingModel,
	mockSelectNextEditModel,
	mockGetProvider,
	mockGetResponse,
} = vi.hoisted(() => {
	const mockGetResponse = vi.fn();
	return {
		mockGetModelConfig: vi.fn(),
		mockGetModelConfigByMatchingModel: vi.fn(),
		mockSelectNextEditModel: vi.fn(),
		mockGetProvider: vi.fn(() => ({
			getResponse: mockGetResponse,
		})),
		mockGetResponse,
	};
});

vi.mock("~/lib/models", () => ({
	getModelConfig: mockGetModelConfig,
	getModelConfigByMatchingModel: mockGetModelConfigByMatchingModel,
}));

vi.mock("~/lib/modelRouter", () => ({
	ModelRouter: {
		selectNextEditModel: mockSelectNextEditModel,
	},
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: mockGetProvider,
}));

import { handleCreateNextEditCompletions } from "../createNextEditCompletions";
import { AssistantError, ErrorType } from "~/utils/errors";

const env = {} as any;
const user = { id: 1 } as any;

describe("handleCreateNextEditCompletions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws when messages missing", async () => {
		await expect(
			handleCreateNextEditCompletions({ env, messages: [] }),
		).rejects.toMatchObject({ type: ErrorType.PARAMS_ERROR });
	});

	it("selects model when not provided", async () => {
		mockSelectNextEditModel.mockReturnValue("mercury-coder");
		mockGetModelConfig.mockResolvedValue({
			matchingModel: "mercury-coder",
			provider: "inception",
			supportsNextEdit: true,
		});
		mockGetResponse.mockResolvedValue({ choices: [] });

		const result = await handleCreateNextEditCompletions({
			env,
			messages: [{ role: "user", content: "test" }],
		});

		expect(mockSelectNextEditModel).toHaveBeenCalled();
		expect(mockGetProvider).toHaveBeenCalledWith("inception", {
			env,
			user: undefined,
		});
		const [payload, userId] = mockGetResponse.mock.calls[0];
		expect(payload).toEqual({
			env,
			user: undefined,
			model: "mercury-coder",
			messages: [
				{
					role: "user",
					content: "test",
					name: undefined,
					tool_calls: undefined,
					parts: undefined,
					status: undefined,
					data: undefined,
					model: undefined,
					log_id: undefined,
					citations: undefined,
					app: undefined,
					id: undefined,
					timestamp: undefined,
					platform: undefined,
				},
			],
			stream: undefined,
			edit_operation: "next",
		});
		expect(userId).toBeUndefined();
		expect(result).toEqual({ choices: [] });
	});

	it("throws when model lacks edit support", async () => {
		mockGetModelConfig.mockResolvedValue({
			matchingModel: "mercury-coder",
			provider: "inception",
			supportsNextEdit: false,
		});

		await expect(
			handleCreateNextEditCompletions({
				env,
				model: "mercury-coder",
				messages: [{ role: "user", content: "test" }],
			}),
		).rejects.toBeInstanceOf(AssistantError);
	});

	it("passes through stream flag", async () => {
		mockGetModelConfig.mockResolvedValue({
			matchingModel: "mercury-coder",
			provider: "inception",
			supportsNextEdit: true,
		});
		mockGetResponse.mockResolvedValue({});

		await handleCreateNextEditCompletions({
			env,
			user,
			model: "mercury-coder",
			messages: [{ role: "user", content: "payload" }],
			stream: true,
		});

		const [payload, userId] = mockGetResponse.mock.calls[0];
		expect(payload.stream).toBe(true);
		expect(userId).toBe(user.id);
	});
});
