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

	it("renders media arena scores with Artificial Analysis links", () => {
		render(
			<ArtificialAnalysisScorePanel
				analysis={{
					mediaScores: [
						{
							key: "textToImageElo",
							label: "Text-to-image arena",
							value: 1266,
							min: 800,
							max: 1400,
							confidenceInterval95: 11,
						},
						{
							key: "aaWerIndex",
							label: "Word Error Rate",
							value: 0.04,
							min: 0,
							max: 1,
							lowerIsBetter: true,
						},
					],
				}}
			/>,
		);

		expect(screen.getByText("Artificial Analysis scores")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Text-to-image arena score 1266" })).toHaveAttribute(
			"href",
			"https://artificialanalysis.ai/evaluations",
		);
		expect(screen.getByText("±11")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Word Error Rate score 0.04" })).toHaveAttribute(
			"href",
			"https://artificialanalysis.ai/evaluations",
		);
	});
});
