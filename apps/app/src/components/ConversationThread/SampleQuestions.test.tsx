import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SampleQuestions } from "./SampleQuestions";

const mocks = vi.hoisted(() => ({
	trackEvent: vi.fn(),
	uiState: {
		isMobile: false,
		isMobileLoading: true,
	},
}));

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({ trackEvent: mocks.trackEvent }),
}));

vi.mock("~/state/stores/uiStore", () => ({
	useUIStore: () => mocks.uiState,
}));

describe("SampleQuestions", () => {
	beforeEach(() => {
		mocks.trackEvent.mockClear();
		mocks.uiState.isMobile = false;
		mocks.uiState.isMobileLoading = true;
	});

	it("reserves the suggestion layout while client state is loading", () => {
		render(<SampleQuestions setInput={vi.fn()} />);

		expect(screen.getByRole("status", { name: "Loading suggested questions" })).toBeInTheDocument();
	});

	it("does not show loading suggestions when a mode explicitly hides them", () => {
		render(<SampleQuestions setInput={vi.fn()} questionsOverride={[]} />);

		expect(
			screen.queryByRole("status", { name: "Loading suggested questions" }),
		).not.toBeInTheDocument();
	});

	it("renders the final question geometry without waiting for an effect", () => {
		mocks.uiState.isMobileLoading = false;

		render(<SampleQuestions setInput={vi.fn()} />);

		expect(
			within(screen.getByLabelText("Suggested questions")).getAllByRole("button"),
		).toHaveLength(4);
	});
});
