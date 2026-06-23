import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArtificialAnalysisScorePanel } from "./ArtificialAnalysisScorePanel";

describe("ArtificialAnalysisScorePanel", () => {
	it("renders evaluation gauges with Artificial Analysis links", () => {
		render(
			<ArtificialAnalysisScorePanel
				analysis={{
					intelligenceIndex: 72,
					codingIndex: 64.5,
					agenticIndex: 69,
					intelligenceIndexVersion: 4.1,
				}}
			/>,
		);

		expect(screen.getByText("Evaluation scores")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Intelligence score 72" })).toHaveAttribute(
			"href",
			"https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index",
		);
		expect(screen.getByRole("link", { name: "Coding score 64.5" })).toHaveAttribute(
			"href",
			"https://artificialanalysis.ai/evaluations",
		);
		expect(screen.getByRole("link", { name: /Data from Artificial Analysis/ })).toHaveAttribute(
			"href",
			"https://artificialanalysis.ai/",
		);
	});
});
