import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	ProjectOverviewSkeleton,
	WorkCardGridSkeleton,
	WorkspaceMembersSkeleton,
	WorkspaceOverviewSkeleton,
} from "./WorkLoadingSkeletons";

describe("Work loading skeletons", () => {
	it("keeps known page and section titles visible while content loads", () => {
		const { rerender } = render(<WorkspaceMembersSkeleton />);

		expect(screen.getByRole("heading", { name: "People & access" })).toBeInTheDocument();
		expect(screen.getByRole("status", { name: "Loading people" })).toBeInTheDocument();
		expect(screen.queryByText("Loading people…")).not.toBeInTheDocument();

		rerender(<WorkspaceOverviewSkeleton />);
		expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();

		rerender(<ProjectOverviewSkeleton />);
		expect(screen.getByRole("heading", { name: "Recent conversations" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Project brief" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Project capabilities" })).toBeInTheDocument();
	});

	it("exposes content skeletons as accessible loading regions", () => {
		render(<WorkCardGridSkeleton label="Loading workspaces" />);

		expect(screen.getByRole("status", { name: "Loading workspaces" })).toBeInTheDocument();
		expect(screen.queryByText("Loading workspaces…")).not.toBeInTheDocument();
	});
});
