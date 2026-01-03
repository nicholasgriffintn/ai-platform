import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retry_with_backoff, fallback } from "../error_recovery";
import type { IRequest } from "~/types";
import * as functionsIndex from "../index";

const baseRequest: IRequest = {
	env: {} as any,
	user: { id: 1, plan_id: "pro" } as any,
};

describe("retry_with_backoff", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("succeeds on first attempt", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockResolvedValue({
				status: "success",
				content: "Function succeeded",
			});

		const resultPromise = retry_with_backoff.function(
			"completion_id",
			{
				function_name: "web_search",
				args: { query: "test" },
				max_attempts: 3,
			},
			baseRequest,
		);

		const result = await resultPromise;

		expect(result.status).toBe("success");
		expect(result.data?.attempts).toBe(1);
		expect(mockHandleFunctions).toHaveBeenCalledTimes(1);
	});

	it("retries on failure and eventually succeeds", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockRejectedValueOnce(new Error("First attempt failed"))
			.mockRejectedValueOnce(new Error("Second attempt failed"))
			.mockResolvedValueOnce({
				status: "success",
				content: "Third attempt succeeded",
			});

		const resultPromise = retry_with_backoff.function(
			"completion_id",
			{
				function_name: "web_search",
				args: { query: "test" },
				max_attempts: 3,
				backoff_factor: 1,
			},
			baseRequest,
		);

		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.status).toBe("success");
		expect(result.data?.attempts).toBe(3);
		expect(result.data?.attempt_details).toHaveLength(3);
		expect(mockHandleFunctions).toHaveBeenCalledTimes(3);
	});

	it("fails after max attempts", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockRejectedValue(new Error("Always fails"));

		const resultPromise = retry_with_backoff.function(
			"completion_id",
			{
				function_name: "web_search",
				args: { query: "test" },
				max_attempts: 2,
			},
			baseRequest,
		);

		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.status).toBe("error");
		expect(result.data?.attempts).toBe(2);
		expect(result.data?.final_error).toBe("Always fails");
		expect(mockHandleFunctions).toHaveBeenCalledTimes(2);
	});

	it("respects max_backoff limit", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockRejectedValue(new Error("Always fails"));

		const resultPromise = retry_with_backoff.function(
			"completion_id",
			{
				function_name: "web_search",
				args: { query: "test" },
				max_attempts: 5,
				backoff_factor: 10,
				max_backoff: 5,
			},
			baseRequest,
		);

		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.data?.attempt_details).toBeDefined();
		const delays = result.data?.attempt_details
			.filter((a: any) => a.delay !== undefined)
			.map((a: any) => a.delay);

		for (const delay of delays) {
			expect(delay).toBeLessThanOrEqual(5);
		}
	});

	it("throws error for invalid function_name", async () => {
		await expect(
			retry_with_backoff.function(
				"completion_id",
				{ function_name: "", args: {} },
				baseRequest,
			),
		).rejects.toThrow();
	});
});

describe("fallback", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("uses primary function when it succeeds", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockResolvedValue({
				status: "success",
				content: "Primary succeeded",
			});

		const result = await fallback.function(
			"completion_id",
			{
				primary_function: "web_search",
				primary_args: { query: "test" },
				fallback_function: "research",
				fallback_args: { input: "test" },
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.used_function).toBe("web_search");
		expect(result.data?.fallback_triggered).toBe(false);
		expect(mockHandleFunctions).toHaveBeenCalledTimes(1);
	});

	it("uses fallback when primary fails", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockRejectedValueOnce(new Error("Primary failed"))
			.mockResolvedValueOnce({
				status: "success",
				content: "Fallback succeeded",
			});

		const result = await fallback.function(
			"completion_id",
			{
				primary_function: "web_search",
				primary_args: { query: "test" },
				fallback_function: "research",
				fallback_args: { input: "test" },
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.used_function).toBe("research");
		expect(result.data?.fallback_triggered).toBe(true);
		expect(result.data?.primary_error).toBe("Primary failed");
		expect(mockHandleFunctions).toHaveBeenCalledTimes(2);
	});

	it("fails when both primary and fallback fail", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockRejectedValueOnce(new Error("Primary failed"))
			.mockRejectedValueOnce(new Error("Fallback failed"));

		const result = await fallback.function(
			"completion_id",
			{
				primary_function: "web_search",
				primary_args: { query: "test" },
				fallback_function: "research",
				fallback_args: { input: "test" },
			},
			baseRequest,
		);

		expect(result.status).toBe("error");
		expect(result.data?.primary_error).toBe("Primary failed");
		expect(result.data?.fallback_error).toBe("Fallback failed");
		expect(result.data?.fallback_triggered).toBe(true);
		expect(mockHandleFunctions).toHaveBeenCalledTimes(2);
	});

	it("excludes primary error when include_primary_error is false", async () => {
		const mockHandleFunctions = vi
			.spyOn(functionsIndex, "handleFunctions")
			.mockRejectedValueOnce(new Error("Primary failed"))
			.mockResolvedValueOnce({
				status: "success",
				content: "Fallback succeeded",
			});

		const result = await fallback.function(
			"completion_id",
			{
				primary_function: "web_search",
				primary_args: { query: "test" },
				fallback_function: "research",
				fallback_args: { input: "test" },
				include_primary_error: false,
			},
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.primary_error).toBeUndefined();
	});

	it("throws error for missing primary_function", async () => {
		await expect(
			fallback.function(
				"completion_id",
				{
					primary_args: {},
					fallback_function: "research",
					fallback_args: {},
				},
				baseRequest,
			),
		).rejects.toThrow();
	});

	it("throws error for missing fallback_function", async () => {
		await expect(
			fallback.function(
				"completion_id",
				{
					primary_function: "web_search",
					primary_args: {},
					fallback_args: {},
				},
				baseRequest,
			),
		).rejects.toThrow();
	});
});
