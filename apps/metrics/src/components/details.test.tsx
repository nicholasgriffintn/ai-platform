import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Metric } from "../types";
import { MetricDetails } from "./details";

const baseMetric: Metric = {
	type: "performance",
	name: "chat_completion",
	status: "success",
	error: "",
	traceId: "trace-1",
	metadata: JSON.stringify({
		provider: "openai",
		model: "gpt-5",
		tokenUsage: {
			total_tokens: 42,
		},
	}),
	value: 1200,
	timestamp: "2026-07-04 10:30",
	truncated_time: "2026-07-04 10:30",
	sampleCount: "1",
	minutesAgo: 1,
};

describe("MetricDetails", () => {
	it("renders malformed metadata without crashing the drawer", () => {
		const metric = {
			...baseMetric,
			metadata: "{broken",
		};

		render(<MetricDetails metric={metric} onClose={vi.fn()} />);

		expect(screen.getByText("Metric Details")).toBeInTheDocument();
		expect(screen.getByText("Unknown provider (unknown model)")).toBeInTheDocument();
		expect(screen.getByText((content) => content.includes('"raw": "{broken"'))).toBeInTheDocument();
	});
});
