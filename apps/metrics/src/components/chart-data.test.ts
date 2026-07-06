import { describe, expect, it } from "vitest";

import { buildMetricsChartData } from "./chart-data";

describe("buildMetricsChartData", () => {
	it("sorts metric points by parsed timestamp", () => {
		const result = buildMetricsChartData({
			data: [
				{
					timestamp: "2026-07-04 10:30",
					provider: "openai",
					latency: 100,
					promptTokens: 10,
					completionTokens: 20,
					totalTokens: 30,
				},
				{
					timestamp: "2026-07-04 10:00",
					provider: "anthropic",
					latency: 200,
					promptTokens: 5,
					completionTokens: 15,
					totalTokens: 20,
				},
			],
			interval: 30,
			now: new Date("2026-07-04T10:30:00Z"),
		});

		expect(result.map((point) => point.provider).slice(0, 2)).toEqual(["anthropic", "openai"]);
	});

	it("does not loop when interval is zero", () => {
		const result = buildMetricsChartData({
			data: [
				{
					timestamp: "2026-07-04 10:00",
					provider: "openai",
					latency: 100,
					promptTokens: 10,
					completionTokens: 20,
					totalTokens: 30,
				},
			],
			interval: 0,
			now: new Date("2026-07-04T10:30:00Z"),
		});

		expect(result.length).toBeLessThanOrEqual(3);
	});

	it("caps generated empty buckets for stale metric data", () => {
		const result = buildMetricsChartData({
			data: [
				{
					timestamp: "2026-06-01 00:00",
					provider: "openai",
					latency: 100,
					promptTokens: 10,
					completionTokens: 20,
					totalTokens: 30,
				},
			],
			interval: 1,
			now: new Date("2026-07-04T10:30:00Z"),
			maxGeneratedBuckets: 120,
		});

		expect(result).toHaveLength(121);
		expect(result[result.length - 1]?.latency).toBe(0);
	});
});
