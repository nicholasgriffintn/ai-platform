import { describe, expect, it, beforeEach, vi } from "vitest";

const { mockHandleCreateFim } = vi.hoisted(() => ({
	mockHandleCreateFim: vi.fn(),
}));

vi.mock("~/services/completions/createFimCompletions", () => ({
	handleCreateFimCompletions: mockHandleCreateFim,
}));

import { fill_in_middle_completion } from "../fill_in_middle";
import type { IRequest } from "~/types";

const baseRequest: IRequest = {
	env: {} as any,
	user: { id: 42, plan_id: "pro" } as any,
};

describe("fill_in_middle_completion function", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns an error when prompt is missing", async () => {
		const result = await fill_in_middle_completion.function(
			"completion",
			{ suffix: "world" },
			baseRequest,
		);

		expect(result.status).toBe("error");
		expect(mockHandleCreateFim).not.toHaveBeenCalled();
	});

	it("normalizes arguments and returns generated text from response.response", async () => {
		mockHandleCreateFim.mockResolvedValueOnce({
			model: "codestral-latest",
			response: "generated content",
		});

		const result = await fill_in_middle_completion.function(
			"completion",
			{
				prompt: "console.log(",
				suffix: ");",
				model: "codestral-latest",
				max_tokens: "128",
				min_tokens: "10",
				temperature: "0.2",
				top_p: "0.9",
				stop: "END,STOP",
			},
			baseRequest,
		);

		expect(mockHandleCreateFim).toHaveBeenCalledTimes(1);
		expect(mockHandleCreateFim).toHaveBeenCalledWith({
			env: baseRequest.env,
			user: baseRequest.user,
			model: "codestral-latest",
			prompt: "console.log(",
			suffix: ");",
			max_tokens: 128,
			min_tokens: 10,
			temperature: 0.2,
			top_p: 0.9,
			stop: ["END", "STOP"],
		});

		expect(result.status).toBe("success");
		expect(result.content).toBe("generated content");
		expect(result.data.model).toBe("codestral-latest");
	});

	it("uses fallback text when provider returns choices array", async () => {
		mockHandleCreateFim.mockResolvedValueOnce({
			model: "codestral-latest",
			choices: [{ text: "fill me in", index: 0 }],
		});

		const result = await fill_in_middle_completion.function(
			"completion",
			{
				prompt: "function main() {",
				stop: ["}"],
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.content).toBe("fill me in");
		expect(result.data.text).toBe("fill me in");
		expect(mockHandleCreateFim).toHaveBeenCalledWith({
			env: baseRequest.env,
			user: baseRequest.user,
			model: undefined,
			prompt: "function main() {",
			suffix: undefined,
			max_tokens: undefined,
			min_tokens: undefined,
			temperature: undefined,
			top_p: undefined,
			stop: ["}"],
		});
	});

	it("handles string response from provider", async () => {
		mockHandleCreateFim.mockResolvedValueOnce("filled content");

		const result = await fill_in_middle_completion.function(
			"completion",
			{
				prompt: "SELECT * FROM users WHERE",
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.content).toBe("filled content");
	});
});
