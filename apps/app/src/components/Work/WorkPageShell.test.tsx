import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { WorkPageShell } from "./WorkPageShell";

vi.mock("~/components/Core/PageShell", () => ({
	PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/components/Core/ProductModeHeader", () => ({
	ProductModeHeader: () => <div>Product header</div>,
}));

vi.mock("~/components/ConversationThread/ConversationProductHeader", () => ({
	ConversationProductHeader: () => <div>Conversation header</div>,
}));

vi.mock("./WorkSidebar", () => ({
	WorkSidebar: () => null,
}));

describe("WorkPageShell", () => {
	beforeEach(() => {
		useChatStore.setState({
			isAuthenticated: false,
			isAuthenticationLoading: false,
			isPro: false,
		});
		useUIStore.setState({ showLoginModal: false });
	});

	it("shows the shared sign-in state on protected Work routes", () => {
		render(
			<MemoryRouter>
				<WorkPageShell workspaceId="workspace-1">
					<div>Private workspace content</div>
				</WorkPageShell>
			</MemoryRouter>,
		);

		expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
		expect(screen.queryByText("Private workspace content")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
		expect(useUIStore.getState().showLoginModal).toBe(true);
	});

	it("shows the Pro upgrade state instead of protected content for free users", () => {
		useChatStore.setState({ isAuthenticated: true, isPro: false });

		render(
			<MemoryRouter>
				<WorkPageShell workspaceId="workspace-1">
					<div>Private workspace content</div>
				</WorkPageShell>
			</MemoryRouter>,
		);

		expect(screen.getByRole("heading", { name: "Unlock shared workspaces." })).toBeInTheDocument();
		expect(screen.queryByText("Private workspace content")).not.toBeInTheDocument();
	});

	it("uses the conversation header on project chat routes", () => {
		useChatStore.setState({ isAuthenticated: true, isPro: true });

		render(
			<MemoryRouter initialEntries={["/work/workspace-1/projects/project-1/chat"]}>
				<WorkPageShell workspaceId="workspace-1" projectId="project-1">
					<div>Project conversation</div>
				</WorkPageShell>
			</MemoryRouter>,
		);

		expect(screen.getByText("Conversation header")).toBeInTheDocument();
		expect(screen.queryByText("Product header")).not.toBeInTheDocument();
	});
});
