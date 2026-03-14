import { describe, expect, it } from "vitest";
import { search_functions, get_function_schema } from "../discovery";
import type { IRequest } from "~/types";

const baseRequest: IRequest = {
	env: {} as any,
	user: { id: 1, plan_id: "pro" } as any,
};

const freeUserRequest: IRequest = {
	env: {} as any,
	user: { id: 2, plan_id: "free" } as any,
};

describe("search_functions", () => {
	it("finds functions by name match", async () => {
		const result = await search_functions.function(
			"completion_id",
			{ query: "weather" },
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.results).toBeDefined();
		expect(result.data?.results.length).toBeGreaterThan(0);
		expect(
			result.data?.results.some((r: any) => r.name === "get_weather"),
		).toBe(true);
	});

	it("finds functions by description keywords", async () => {
		const result = await search_functions.function(
			"completion_id",
			{ query: "search web information" },
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.results).toBeDefined();
		expect(result.data?.results.length).toBeGreaterThan(0);
		expect(result.data?.results.some((r: any) => r.name === "web_search")).toBe(
			true,
		);
	});

	it("limits results based on limit parameter", async () => {
		const result = await search_functions.function(
			"completion_id",
			{ query: "create", limit: 3 },
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.results.length).toBeLessThanOrEqual(3);
	});

	it("excludes premium functions for free users when include_premium is false", async () => {
		const result = await search_functions.function(
			"completion_id",
			{ query: "research", include_premium: false },
			freeUserRequest,
		);

		expect(result.status).toBe("success");
		const premiumResults = result.data?.results.filter(
			(r: any) => r.type === "premium",
		);
		expect(premiumResults?.length).toBe(0);
	});

	it("marks premium functions as unavailable for free users", async () => {
		const result = await search_functions.function(
			"completion_id",
			{ query: "research", include_premium: true },
			freeUserRequest,
		);

		expect(result.status).toBe("success");
		const researchFunc = result.data?.results.find(
			(r: any) => r.name === "research",
		);
		if (researchFunc) {
			expect(researchFunc.available).toBe(false);
		}
	});

	it("throws error for empty query", async () => {
		await expect(
			search_functions.function("completion_id", { query: "" }, baseRequest),
		).rejects.toThrow();
	});
});

describe("get_function_schema", () => {
	it("retrieves schema for existing function", async () => {
		const result = await get_function_schema.function(
			"completion_id",
			{ function_name: "web_search" },
			baseRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.name).toBe("web_search");
		expect(result.data?.description).toBeDefined();
		expect(result.data?.parameters).toBeDefined();
		expect(result.data?.type).toBe("normal");
		expect(result.data?.available).toBe(true);
	});

	it("returns error for non-existent function", async () => {
		const result = await get_function_schema.function(
			"completion_id",
			{ function_name: "nonexistent_function" },
			baseRequest,
		);

		expect(result.status).toBe("error");
		expect(result.content).toContain("not found");
		expect(result.data?.available_functions).toBeDefined();
	});

	it("marks premium function as unavailable for free users", async () => {
		const result = await get_function_schema.function(
			"completion_id",
			{ function_name: "research" },
			freeUserRequest,
		);

		expect(result.status).toBe("success");
		expect(result.data?.type).toBe("premium");
		expect(result.data?.available).toBe(false);
		expect(result.data?.requires_upgrade).toBe(true);
	});

	it("throws error for empty function name", async () => {
		await expect(
			get_function_schema.function(
				"completion_id",
				{ function_name: "" },
				baseRequest,
			),
		).rejects.toThrow();
	});
});
