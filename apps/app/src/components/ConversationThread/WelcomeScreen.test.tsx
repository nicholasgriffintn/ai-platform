import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WelcomeScreen } from "./WelcomeScreen";

const mocks = vi.hoisted(() => ({
	sampleQuestions: vi.fn(() => null),
}));

vi.mock("~/components/Core/Logo", () => ({
	Logo: () => <div data-testid="logo" />,
}));

vi.mock("./SampleQuestions", () => ({
	SampleQuestions: mocks.sampleQuestions,
}));

describe("WelcomeScreen", () => {
	beforeEach(() => {
		mocks.sampleQuestions.mockClear();
	});

	it("reserves the copy layout while personalised text is loading", () => {
		render(
			<WelcomeScreen
				setInput={vi.fn()}
				title="Where to next, Nick?"
				description="Pick up a thread."
				isLoading
			/>,
		);

		const heading = screen.getByRole("heading", { level: 2 });
		expect(heading).toHaveClass("min-h-16");
		expect(heading.firstElementChild).toHaveAttribute("aria-hidden", "true");
		expect(heading.firstElementChild).toHaveClass("opacity-0");
		expect(mocks.sampleQuestions).toHaveBeenCalledWith(
			expect.objectContaining({ isLoading: true }),
			undefined,
		);
	});

	it("reveals final copy with a reduced-motion-safe animation", () => {
		render(
			<WelcomeScreen
				setInput={vi.fn()}
				title="Where to next, Nick?"
				description="Pick up a thread."
			/>,
		);

		expect(screen.getByText("Where to next, Nick?")).toHaveClass(
			"animate-in",
			"motion-reduce:animate-none",
		);
		expect(screen.getByText("Pick up a thread.")).toHaveClass("delay-100");
	});
});
