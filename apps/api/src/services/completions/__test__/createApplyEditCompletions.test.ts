import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockGetModelConfig,
	mockGetModelConfigByMatchingModel,
	mockSelectApplyEditModel,
	mockGetProvider,
	mockGetResponse,
} = vi.hoisted(() => {
	const mockGetResponse = vi.fn();
	return {
		mockGetModelConfig: vi.fn(),
		mockGetModelConfigByMatchingModel: vi.fn(),
		mockSelectApplyEditModel: vi.fn(),
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
		selectApplyEditModel: mockSelectApplyEditModel,
	},
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: mockGetProvider,
}));

import { handleCreateApplyEditCompletions } from "../createApplyEditCompletions";
import { AssistantError, ErrorType } from "~/utils/errors";

const env = {} as any;
const user = { id: 5 } as any;

describe("handleCreateApplyEditCompletions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws when messages missing", async () => {
		await expect(
			handleCreateApplyEditCompletions({ env, messages: [] }),
		).rejects.toMatchObject({ type: ErrorType.PARAMS_ERROR });
	});

	it("selects model when not provided", async () => {
		mockSelectApplyEditModel.mockReturnValue("mercury-coder");
		mockGetModelConfig.mockResolvedValue({
			matchingModel: "mercury-coder",
			provider: "inception",
			supportsApplyEdit: true,
		});
		mockGetResponse.mockResolvedValue({ text: "done" });

		const result = await handleCreateApplyEditCompletions({
			env,
			messages: [{ role: "user", content: "apply" }],
		});

		expect(mockSelectApplyEditModel).toHaveBeenCalled();
		expect(mockGetProvider).toHaveBeenCalledWith("inception", {
			env,
			user: undefined,
		});
		const [payload, userId] = mockGetResponse.mock.calls[0];
		expect(payload.edit_operation).toBe("apply");
		expect(userId).toBeUndefined();
		expect(result).toEqual({ text: "done" });
	});

	it("throws when model lacks apply support", async () => {
		mockGetModelConfig.mockResolvedValue({
			matchingModel: "mercury-coder",
			provider: "inception",
			supportsApplyEdit: false,
		});

		await expect(
			handleCreateApplyEditCompletions({
				env,
				model: "mercury-coder",
				messages: [{ role: "user", content: "apply" }],
			}),
		).rejects.toBeInstanceOf(AssistantError);
	});

	it("passes through user context", async () => {
		mockGetModelConfig.mockResolvedValue({
			matchingModel: "mercury-coder",
			provider: "inception",
			supportsApplyEdit: true,
		});
		mockGetResponse.mockResolvedValue({});

		await handleCreateApplyEditCompletions({
			env,
			user,
			model: "mercury-coder",
			messages: [{ role: "user", content: "apply" }],
		});

		const [payload, userId] = mockGetResponse.mock.calls[0];
		expect(payload.user).toEqual(user);
		expect(userId).toBe(user.id);
	});
});
