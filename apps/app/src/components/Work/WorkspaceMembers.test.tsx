import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceMembers } from "./WorkspaceMembers";

vi.mock("./WorkContext", () => ({
	useWorkData: () => ({
		projectQuery: { data: undefined },
		workspaceQuery: { data: undefined, error: null, isLoading: true },
		workspacesQuery: { data: { workspaces: [] } },
	}),
}));

describe("WorkspaceMembers", () => {
	it("keeps the page title visible while member data loads", () => {
		render(<WorkspaceMembers workspaceId="workspace-1" />);

		expect(screen.getByRole("heading", { name: "People & access" })).toBeInTheDocument();
		expect(screen.getByRole("status", { name: "Loading people" })).toBeInTheDocument();
		expect(screen.queryByText("Loading people…")).not.toBeInTheDocument();
	});
});
