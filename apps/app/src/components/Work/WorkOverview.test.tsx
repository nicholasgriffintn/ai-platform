import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { WorkOverview } from "./WorkOverview";

vi.mock("./CreateWorkspaceDialog", () => ({
	CreateWorkspaceDialog: () => null,
}));

vi.mock("./WorkContext", () => ({
	useWorkData: () => ({
		workspacesQuery: {
			data: { workspaces: [] },
			isLoading: false,
		},
	}),
}));

function renderWorkOverview() {
	return render(
		<MemoryRouter>
			<WorkOverview />
		</MemoryRouter>,
	);
}

describe("WorkOverview", () => {
	beforeEach(() => {
		useChatStore.setState({
			isAuthenticationLoading: false,
			isAuthenticated: false,
			isPro: false,
		});
		useUIStore.setState({ showLoginModal: false });
	});

	it("gives guests a clear path into Work instead of leaving the page empty", () => {
		renderWorkOverview();

		expect(
			screen.getByRole("heading", { name: "Bring your projects together." }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Sign in to unlock Work" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "New workspace" })).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Sign in to unlock Work" }));

		expect(useUIStore.getState().showLoginModal).toBe(true);
	});

	it("explains the Pro requirement to signed-in Free users", () => {
		useChatStore.setState({ isAuthenticated: true, isPro: false });
		renderWorkOverview();

		expect(screen.getByRole("heading", { name: "Unlock shared workspaces." })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute(
			"href",
			"/profile?tab=billing",
		);
		expect(screen.queryByRole("button", { name: "New workspace" })).not.toBeInTheDocument();
	});

	it("keeps the workspace actions available to Pro users", () => {
		useChatStore.setState({ isAuthenticated: true, isPro: true });
		renderWorkOverview();

		expect(screen.getByRole("button", { name: "New workspace" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "No workspaces yet" })).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Unlock shared workspaces." }),
		).not.toBeInTheDocument();
	});
});
