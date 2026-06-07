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

	it("applies caller styling without adding progress text", () => {
		render(<LoadingSpinner className="test-custom-class" />);

		expect(screen.getByRole("status")).toHaveClass("test-custom-class");
		expect(screen.queryByText(/% complete/)).not.toBeInTheDocument();
	});
});
