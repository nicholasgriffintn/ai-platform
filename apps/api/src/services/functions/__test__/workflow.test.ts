import { afterEach, describe, expect, it, vi } from "vitest";
import { compose_functions, if_then_else, parallel_execute } from "../workflow";
import type { IRequest } from "~/types";
import * as functionsIndex from "../index";

const baseRequest: IRequest = {
	env: {} as any,
	user: { id: 1, plan_id: "pro" } as any,
};

describe("compose_functions", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("runs steps in order and resolves output references", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockImplementation(async ({ functionName, args }) => {
				if (functionName === "web_search") {
					return {
						status: "success",
						content: "search",
						data: { items: ["a", "b"] },
					};
				}
				if (functionName === "analyze_dataset") {
					return {
						status: "success",
						content: "analysis",
						data: { ok: true, input: args },
					};
				}
				throw new Error("unexpected");
			});

		const result = await compose_functions.function(
			"completion_id",
			{
				steps: [
					{
						function: "web_search",
						args: { query: "test" },
						output_var: "search_results",
					},
					{
						function: "analyze_dataset",
						args: { data: "$search_results.data" },
						output_var: "analysis",
					},
				],
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.steps).toHaveLength(2);
		expect(mockHandleFunctions).toHaveBeenCalledTimes(2);
		expect(mockHandleFunctions.mock.calls[1][0].args).toEqual({
			data: { items: ["a", "b"] },
		});
	});

	it("parses steps when provided as JSON string", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockResolvedValue({
				status: "success",
				content: "ok",
			});

		const result = await compose_functions.function(
			"completion_id",
			{
				steps: JSON.stringify([
					{ function: "web_search", args: { query: "test" } },
				]),
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(mockHandleFunctions).toHaveBeenCalledTimes(1);
	});

	it("supports skip-on-error steps", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce({
				status: "success",
				content: "fallback",
			});

		const result = await compose_functions.function(
			"completion_id",
			{
				steps: [
					{
						function: "web_search",
						args: { query: "test" },
						on_error: "skip",
					},
					{
						function: "research",
						args: { input: "next" },
					},
				],
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.steps).toHaveLength(2);
		expect(mockHandleFunctions).toHaveBeenCalledTimes(2);
	});
});

describe("if_then_else", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("executes then_steps when condition is true", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockResolvedValueOnce({
				status: "success",
				content: "true",
				data: { result: true },
			})
			.mockResolvedValueOnce({
				status: "success",
				content: "then",
			});

		const result = await if_then_else.function(
			"completion_id",
			{
				condition: { function: "check_condition", args: { value: 1 } },
				then_steps: [{ function: "web_search", args: { query: "ok" } }],
				else_steps: [{ function: "research", args: { input: "no" } }],
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.branch).toBe("then");
		expect(mockHandleFunctions).toHaveBeenCalledTimes(2);
	});

	it("parses condition when provided as JSON string", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockResolvedValueOnce({
				status: "success",
				content: "true",
				data: { result: true },
			})
			.mockResolvedValueOnce({
				status: "success",
				content: "then",
			});

		const result = await if_then_else.function(
			"completion_id",
			{
				condition: JSON.stringify({
					function: "check_condition",
					args: { value: 1 },
				}),
				then_steps: [{ function: "web_search", args: { query: "ok" } }],
				else_steps: [{ function: "research", args: { input: "no" } }],
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.branch).toBe("then");
		expect(mockHandleFunctions).toHaveBeenCalledTimes(2);
	});
});

describe("parallel_execute", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("runs tasks in parallel and reports failures", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockResolvedValueOnce({
				status: "success",
				content: "ok",
			})
			.mockRejectedValueOnce(new Error("fail"));

		const result = await parallel_execute.function(
			"completion_id",
			{
				tasks: [
					{ function: "web_search", args: { query: "test" } },
					{ function: "research", args: { input: "test" } },
				],
			},
			baseRequest,
		);

		expect(result.status).toBe("error");
		expect(result.data?.failed_count).toBe(1);
		expect(mockHandleFunctions).toHaveBeenCalledTimes(2);
	});

	it("parses tasks when provided as JSON string", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockResolvedValue({
				status: "success",
				content: "ok",
			});

		const result = await parallel_execute.function(
			"completion_id",
			{
				tasks: JSON.stringify([
					{ function: "web_search", args: { query: "test" } },
				]),
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(mockHandleFunctions).toHaveBeenCalledTimes(1);
	});
});
