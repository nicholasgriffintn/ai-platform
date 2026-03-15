import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHandleApplyEdit } = vi.hoisted(() => ({
	mockHandleApplyEdit: vi.fn(),
}));

vi.mock("~/services/completions/createApplyEditCompletions", () => ({
	handleCreateApplyEditCompletions: mockHandleApplyEdit,
}));

import { apply_edit_completion } from "../apply_edit";
import type { IRequest } from "~/types";

const baseRequest: IRequest = {
	env: {} as any,
	user: { id: 9 } as any,
};

const createToolContext = (request: IRequest, completionId = "id") => ({
	completionId,
	env: request.env,
	user: request.user,
	request,
});

describe("apply_edit_completion function", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("validates prompt presence", async () => {
		const result = await apply_edit_completion.execute(
			{ prompt: "" },
			createToolContext(baseRequest),
		);

		expect(result.status).toBe("error");
		expect(mockHandleApplyEdit).not.toHaveBeenCalled();
	});

	it("returns applied edit content", async () => {
		mockHandleApplyEdit.mockResolvedValue({
			choices: [
				{
					message: { content: "updated code" },
				},
			],
		});

		const result = await apply_edit_completion.execute(
			{ prompt: "<apply>" },
			createToolContext(baseRequest),
		);

		expect(mockHandleApplyEdit).toHaveBeenCalledWith({
			env: baseRequest.env,
			user: baseRequest.user,
			model: undefined,
			messages: [{ role: "user", content: "<apply>" }],
		});
		expect(result.status).toBe("success");
		expect(result.content).toBe("updated code");
	});

	it("handles empty response", async () => {
		mockHandleApplyEdit.mockResolvedValue({});

		const result = await apply_edit_completion.execute(
			{ prompt: "<apply>" },
			createToolContext(baseRequest),
		);

		expect(result.status).toBe("error");
		expect(result.data).toEqual({});
	});
});
