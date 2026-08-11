import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { InvitationAcceptPage } from "./InvitationAcceptPage";

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
		selector({ isAuthenticated: false }),
}));

vi.mock("~/state/stores/uiStore", () => ({
	useUIStore: (selector: (state: { setShowLoginModal: () => void }) => unknown) =>
		selector({ setShowLoginModal: vi.fn() }),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
	useAcceptWorkspaceInvitation: () => ({
		data: undefined,
		error: null,
		isPending: false,
		mutate: vi.fn(),
	}),
}));

describe("InvitationAcceptPage", () => {
	it("makes the sign-in action a primary full-width button", () => {
		render(
			<MemoryRouter initialEntries={["/work/invitations?token=token"]}>
				<InvitationAcceptPage />
			</MemoryRouter>,
		);

		expect(screen.getByRole("button", { name: "Sign in to accept" })).toHaveClass(
			"bg-blue-600",
			"w-full",
		);
	});
});
