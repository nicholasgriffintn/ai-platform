import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { WorkPageShell } from "./WorkPageShell";

vi.mock("~/components/Core/PageShell", () => ({
	PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/components/Core/ProductModeHeader", () => ({
	ProductModeHeader: () => null,
}));

vi.mock("./WorkSidebar", () => ({
	WorkSidebar: () => null,
}));

describe("WorkPageShell", () => {
	beforeEach(() => {
		useChatStore.setState({ isAuthenticated: false, isAuthenticationLoading: false });
		useUIStore.setState({ showLoginModal: false });
	});

	it("shows the shared sign-in state on protected Work routes", () => {
		render(
			<WorkPageShell workspaceId="workspace-1">
				<div>Private workspace content</div>
			</WorkPageShell>,
		);

		expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
		expect(screen.queryByText("Private workspace content")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
		expect(useUIStore.getState().showLoginModal).toBe(true);
	});
});
