import { describe, expect, it } from "vitest";

import { normaliseMetricsFilters } from "./filters";

const fallbackFilters = {
	status: "success",
	limit: 100,
	interval: 30,
	timeframe: 24,
};

describe("normaliseMetricsFilters", () => {
	it("falls back for empty or non-numeric numeric fields", () => {
		expect(
			normaliseMetricsFilters(
				{
					status: "success",
					limit: "",
					interval: "not-a-number",
					timeframe: null,
				},
				fallbackFilters,
			),
		).toEqual(fallbackFilters);
	});

	it("clamps numeric filters to the API-supported bounds", () => {
		expect(
			normaliseMetricsFilters(
				{
					status: "error",
					limit: "0",
					interval: "2000",
					timeframe: "999",
				},
				fallbackFilters,
			),
		).toEqual({
			status: "error",
			limit: 1,
			interval: 1440,
			timeframe: 168,
		});
	});

	it("falls back for unknown status values", () => {
		expect(
			normaliseMetricsFilters(
				{
					status: "pending",
					limit: "50",
					interval: "15",
					timeframe: "12",
				},
				fallbackFilters,
			),
		).toEqual({
			status: "success",
			limit: 50,
			interval: 15,
			timeframe: 12,
		});
	});
});
