import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "~/state/stores/uiStore";
import { SignInEmptyState } from "./SignInEmptyState";

describe("SignInEmptyState", () => {
	beforeEach(() => {
		useUIStore.setState({ showLoginModal: false });
	});

	it("offers the shared sign-in action", () => {
		render(<SignInEmptyState />);

		expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

		expect(useUIStore.getState().showLoginModal).toBe(true);
	});
});
