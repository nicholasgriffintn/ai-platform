import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveModelConfig, mockSelectNextEditModel, mockGetProvider, mockGetResponse } =
	vi.hoisted(() => {
		const mockGetResponse = vi.fn();
		return {
			mockResolveModelConfig: vi.fn(),
			mockSelectNextEditModel: vi.fn(),
			mockGetProvider: vi.fn(() => ({
				getResponse: mockGetResponse,
			})),
			mockGetResponse,
		};
	});

vi.mock("~/lib/providers/models", () => ({
	resolveModelConfig: mockResolveModelConfig,
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

const env = { DB: "test-db" } as any;
const user = { id: 1 } as any;

describe("handleCreateNextEditCompletions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws when messages missing", async () => {
		await expect(handleCreateNextEditCompletions({ env, messages: [] })).rejects.toMatchObject({
			type: ErrorType.PARAMS_ERROR,
		});
	});

	it("selects model when not provided", async () => {
		mockSelectNextEditModel.mockReturnValue("mercury-coder");
		mockResolveModelConfig.mockResolvedValue({
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
		expect(payload).toMatchObject({
			env,
			context: expect.objectContaining({
				user: null,
			}),
			model: "mercury-coder",
			provider: "inception",
			messages: [
				{
					role: "user",
					content: "test",
				},
			],
			stream: undefined,
			edit_operation: "next",
		});
		expect(userId).toBeUndefined();
		expect(result).toEqual({ choices: [] });
	});

	it("throws when model lacks edit support", async () => {
		mockResolveModelConfig.mockResolvedValue({
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
		mockResolveModelConfig.mockResolvedValue({
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

	it("excludes compaction markers from provider messages", async () => {
		mockResolveModelConfig.mockResolvedValue({
			matchingModel: "mercury-coder",
			provider: "inception",
			supportsNextEdit: true,
		});
		mockGetResponse.mockResolvedValue({});

		await handleCreateNextEditCompletions({
			env,
			model: "mercury-coder",
			messages: [
				{ role: "user", content: "test" },
				{
					role: "compaction",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
			],
		});

		const [payload] = mockGetResponse.mock.calls[0];
		expect(payload.messages).toEqual([expect.objectContaining({ role: "user", content: "test" })]);
	});

	it("excludes malformed assistant-shaped compaction metadata from provider messages", async () => {
		mockResolveModelConfig.mockResolvedValue({
			matchingModel: "mercury-coder",
			provider: "inception",
			supportsNextEdit: true,
		});
		mockGetResponse.mockResolvedValue({});

		await handleCreateNextEditCompletions({
			env,
			model: "mercury-coder",
			messages: [
				{ role: "user", content: "test" },
				{
					role: "assistant",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
				},
				{ role: "assistant", content: "answer" },
			],
		});

		const [payload] = mockGetResponse.mock.calls[0];
		expect(payload.messages).toEqual([
			expect.objectContaining({ role: "user", content: "test" }),
			expect.objectContaining({ role: "assistant", content: "answer" }),
		]);
	});
});
