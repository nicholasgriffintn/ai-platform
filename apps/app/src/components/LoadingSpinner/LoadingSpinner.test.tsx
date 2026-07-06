import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSpinner } from ".";

describe("LoadingSpinner", () => {
	it("exposes accessible status text and rounded progress", () => {
		render(<LoadingSpinner message="Loading test data..." progress={75.6} />);

		const status = screen.getByRole("status");

		expect(status).toHaveAttribute("aria-live", "polite");
		expect(screen.getByText("Loading test data...", { selector: "p" })).toBeInTheDocument();
		expect(screen.getByText("76%", { selector: ".text-xs" })).toBeInTheDocument();
		expect(screen.getByText(", 76% complete", { selector: ".sr-only" })).toBeInTheDocument();
	});

	it("clamps progress and exposes clean status text without a message", () => {
		render(<LoadingSpinner progress={125.6} />);

		expect(screen.getByText("100%", { selector: ".text-xs" })).toBeInTheDocument();
		expect(screen.getByText("100% complete", { selector: ".sr-only" })).toBeInTheDocument();
		expect(screen.queryByText(", 100% complete")).not.toBeInTheDocument();
	});
});
