import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceMembers } from "./WorkspaceMembers";

vi.mock("~/hooks/useWorkspaces", () => ({
	useWorkspace: () => ({ data: undefined, error: null, isLoading: true }),
}));
vi.mock("./WorkPageShell", () => ({
	WorkPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("WorkspaceMembers", () => {
	it("keeps the page title visible while member data loads", () => {
		render(<WorkspaceMembers workspaceId="workspace-1" />);

		expect(screen.getByRole("heading", { name: "People & access" })).toBeInTheDocument();
		expect(screen.getByRole("status", { name: "Loading people" })).toBeInTheDocument();
		expect(screen.queryByText("Loading people…")).not.toBeInTheDocument();
	});
});
