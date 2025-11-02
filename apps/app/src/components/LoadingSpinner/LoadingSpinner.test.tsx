import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSpinner } from ".";

describe("LoadingSpinner", () => {
	it("renders without crashing", () => {
		render(<LoadingSpinner />);
		expect(screen.getByRole("status")).toBeInTheDocument();
	});

	it("displays the message when provided", () => {
		const testMessage = "Loading test data...";
		render(<LoadingSpinner message={testMessage} />);
		expect(
			screen.getByText(testMessage, { selector: "p" }),
		).toBeInTheDocument();
	});

	it("displays progress percentage when provided", () => {
		const testProgress = 75;
		render(<LoadingSpinner progress={testProgress} />);
		expect(
			screen.getByText("75%", { selector: ".text-xs" }),
		).toBeInTheDocument();
	});

	it("applies custom class names when provided", () => {
		render(<LoadingSpinner className="test-custom-class" />);
		expect(screen.getByRole("status")).toHaveClass("test-custom-class");
	});

	it("rounds progress percentage value", () => {
		render(<LoadingSpinner progress={75.6} />);
		expect(
			screen.getByText("76%", { selector: ".text-xs" }),
		).toBeInTheDocument();
	});

	it("includes progress completion text in screen reader content", () => {
		render(<LoadingSpinner progress={50} />);
		expect(
			screen.getByText(", 50% complete", { selector: ".sr-only" }),
		).toBeInTheDocument();
	});

	it("has no progress text in screen reader when progress not provided", () => {
		render(<LoadingSpinner message="Loading" />);
		expect(screen.getByText("", { selector: ".sr-only" })).toBeInTheDocument();
	});

	it("has correct aria attributes for accessibility", () => {
		render(<LoadingSpinner />);
		const status = screen.getByRole("status");
		expect(status).toHaveAttribute("aria-live", "polite");
	});
});
